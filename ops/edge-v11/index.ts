// ============================================================================
// Edge Function: pergunte-ao-farol
// ----------------------------------------------------------------------------
// Recebe uma pergunta do colaborador + a base de conhecimento (FAQ e
// Empreendimentos, já montada pelo Farol em montarBaseConhecimento()) e usa
// o Gemini pra gerar uma resposta em português.
//
// Ordem de prioridade da resposta (em camadas):
//   1. Conteúdo oficial da plataforma (FAQ/Empreendimentos/o que mais for
//      alimentado no Supabase) — se a resposta está lá, usa só isso.
//   2. Se a plataforma não cobre a pergunta, busca em fontes confiáveis na
//      internet (Google Search grounding, nativo da API do Gemini) — sinalizado
//      claramente como "Fonte externa", pra quem lê saber que não veio da
//      base validada pela empresa.
//   3. Se nem a plataforma nem a busca externa encontram nada confiável, o
//      modelo é instruído a admitir isso com honestidade — nunca inventar
//      uma resposta pra parecer completo.
//
// O Farol funciona como um assistente/tutor geral: não fica restrito a
// dúvidas de atendimento ao cliente, serve qualquer área que alimentar
// conteúdo na plataforma.
//
// Contrato com o cliente (Farol):
//   Requisição:  { pergunta: string, base: string }
//   Resposta ok:  { resposta: string }
//   Resposta erro: { error: string (amigável, pra tela), categoria: string
//                    (chave pra escolher a mensagem certa no cliente),
//                    detalhe: string (texto técnico completo — só pro
//                    console.error do navegador, nunca mostrado na tela) }
//
// Categorias possíveis: 'quota' | 'auth' | 'configuracao' | 'servidor' |
// 'conteudo' | 'rede' | 'entrada' | 'desconhecido'
// ============================================================================

const GEMINI_MODEL = "gemini-3.1-flash-lite"; // nível gratuito: 1.500 req/dia, 30 req/min
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// Monta uma resposta de erro categorizada: 'error' é o texto amigável pra
// tela, 'detalhe' é o texto técnico completo (o cliente manda pro console,
// nunca exibe). Também loga aqui, pro Supabase Logs continuar funcionando
// como canal de diagnóstico mais profundo quando precisar.
function erroCategorizado(
  categoria: string,
  mensagemAmigavel: string,
  detalheTecnico: string,
  status: number,
) {
  console.error(`[Gemini][${categoria}]`, detalheTecnico);
  return jsonResponse(
    { error: mensagemAmigavel, categoria, detalhe: detalheTecnico },
    status,
  );
}

Deno.serve(async (req: Request) => {
  // Preflight CORS (o navegador manda isso antes do POST de verdade)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return erroCategorizado(
      "entrada",
      "Requisição inválida.",
      "Método HTTP não permitido: " + req.method,
      405,
    );
  }

  let pergunta: string, base: string;
  try {
    const body = await req.json();
    pergunta = (body?.pergunta ?? "").toString().trim();
    base = (body?.base ?? "").toString();
  } catch (e) {
    return erroCategorizado(
      "entrada",
      "Requisição inválida.",
      "Corpo da requisição não é JSON válido: " + (e as Error).message,
      400,
    );
  }

  if (!pergunta) {
    return erroCategorizado(
      "entrada",
      "Digite uma pergunta antes de enviar.",
      "Campo 'pergunta' veio vazio.",
      400,
    );
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    // Isso só acontece se o secret não foi configurado no projeto Supabase
    return erroCategorizado(
      "configuracao",
      "O assistente está temporariamente indisponível (problema de configuração). A equipe técnica já foi avisada.",
      "Secret GEMINI_API_KEY ausente no projeto Supabase.",
      500,
    );
  }

  // Limite de segurança: nível gratuito do Gemini tem teto de tokens por
  // minuto. Corta a base se vier gigante, pra nunca estourar o limite.
  const BASE_MAX_CHARS = 60000;
  if (base.length > BASE_MAX_CHARS) {
    base = base.slice(0, BASE_MAX_CHARS);
  }

  // Observabilidade barata: registra o tamanho da base enviada em cada
  // chamada, direto nos Logs do Supabase. Sem infraestrutura nova — só
  // pra saber, com dado real, quando vale considerar filtrar o conteúdo
  // em vez de mandar tudo (hoje ainda longe do limite de 60k).
  console.log(`[Farol][base] ${base.length} caracteres enviados (limite: ${BASE_MAX_CHARS})`);

  const systemInstruction =
    "Você é o Farol, o assistente/tutor interno da Canopus. Qualquer área " +
    "da empresa pode alimentar conteúdo na plataforma e contar com você " +
    "pra responder dúvidas de trabalho com base nesse conteúdo — não é " +
    "um assistente exclusivo de atendimento ao cliente, e a resposta é " +
    "um apoio de trabalho pra quem está lendo, não um texto pronto pra " +
    "repassar direto a um cliente sem revisar." +
    "\n\nVocê responde em TRÊS CAMADAS, nesta ordem estrita de prioridade:" +
    "\n\n1) CONTEÚDO OFICIAL DA PLATAFORMA (fornecido abaixo). Procure a " +
    "resposta aqui primeiro. Se encontrar, responda só com base nele, sem " +
    "avisos extras — essa é a fonte de verdade da empresa." +
    "\n\n2) BUSCA EXTERNA CONFIÁVEL. Se a pergunta não está coberta pelo " +
    "conteúdo oficial, e for do tipo que se beneficia de informação " +
    "pública atual (índices econômicos, legislação, notícias, dados de " +
    "mercado, etc.), use a ferramenta de busca do Google disponível pra " +
    "você e responda com base em fontes confiáveis e atuais. Nesse caso, " +
    "comece a resposta com a frase exata 'Isso não está na nossa base " +
    "oficial — buscando em fontes externas:' antes do conteúdo, e cite a " +
    "fonte real (nome do site/órgão) ao final." +
    "\n\n3) ADMITIR O LIMITE. Se nem o conteúdo oficial nem uma busca " +
    "confiável trazem uma resposta sólida, diga isso com honestidade — " +
    "nunca invente ou 'chute' um número, prazo, ou procedimento pra " +
    "parecer completo. Nesses casos responda algo como 'Não encontrei " +
    "essa informação na nossa base nem em fontes externas confiáveis. " +
    "Recomendo confirmar com [área responsável, se for possível inferir " +
    "qual] antes de repassar.'" +
    "\n\nNunca misture as camadas sem avisar qual delas está sendo usada — " +
    "quem lê precisa saber se a informação vem da base validada da " +
    "empresa ou de uma busca externa." +
    "\n\nCITAÇÃO DE FONTE OFICIAL — obrigatório sempre que responder com " +
    "base no conteúdo oficial (camada 1): cada bloco do conteúdo abaixo " +
    "começa com um rótulo ('FAQ: <pergunta>' ou 'EMPREENDIMENTO: <nome>'). " +
    "Ao final da resposta, numa linha própria, adicione 'Fonte: ' seguido " +
    "do(s) rótulo(s) exato(s) que você usou (sem inventar nome de fonte " +
    "que não esteja nos rótulos)." +
    "\n\nCITAÇÃO DE FONTE EXTERNA — obrigatório sempre que responder com " +
    "base em busca externa (camada 2): ao final da resposta, numa linha " +
    "própria, adicione 'Fonte externa: ' seguido do nome do site ou órgão " +
    "de onde veio a informação (ex.: 'Fonte externa: FGV IBRE', 'Fonte " +
    "externa: Banco Central do Brasil')." +
    "\n\nFORMATO DA RESPOSTA — siga estritamente, é texto simples lido por " +
    "um programa, não markdown de verdade:" +
    "\n- Comece com um parágrafo curto (1-3 frases) respondendo direto a " +
    "pergunta." +
    "\n- Se a resposta envolver um processo, procedimento, ou 'como faço " +
    "para', adicione uma seção com o título exato '## Passo a passo' " +
    "seguida dos passos numerados (1. 2. 3. ...), cada um dizendo ONDE ir " +
    "(sistema, tela, menu) e O QUE fazer ali — nunca um passo vago." +
    "\n- Se fizer sentido indicar sistemas, links ou documentos onde a " +
    "pessoa deve consultar ou registrar algo, adicione uma seção '## Onde " +
    "acessar' com uma lista (cada item começando com '- ')." +
    "\n- Cada título de seção começa exatamente com '## ' (duas cerquilhas " +
    "e um espaço) e nada mais na linha." +
    "\n- Nunca use asteriscos, links em formato markdown, negrito, ou " +
    "qualquer símbolo de formatação além dos descritos acima." +
    "\n- Separe cada bloco (parágrafo, título de seção, lista, linha de " +
    "Fonte) com uma linha em branco." +
    "\n- Se a pergunta for simples e não tiver processo nenhum envolvido, " +
    "só o parágrafo inicial (+ a linha de Fonte, se aplicável) já basta — " +
    "não force seções vazias." +
    "\n\nResponda sempre em português do Brasil, direto e objetivo, como " +
    "se estivesse explicando pra um colega de trabalho.\n\n--- CONTEÚDO " +
    "OFICIAL DISPONÍVEL ---\n" + base;

  let geminiRes: Response;
  try {
    geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: pergunta }] }],
        // Ferramenta nativa do Gemini pra buscar no Google quando o modelo
        // decidir que precisa — ele só usa quando o conteúdo oficial acima
        // não resolve a pergunta (isso é controlado pelas instruções, não
        // por um parâmetro separado). Sem isso, a camada 2 (busca externa)
        // não existe: o modelo ficaria só no que aprendeu no treinamento,
        // que é justamente o problema de respostas desatualizadas.
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.3, // baixa = resposta mais fiel ao conteúdo/fontes, menos "criativa"
          maxOutputTokens: 1200, // respostas com busca externa + citação usam um pouco mais de espaço
        },
      }),
    });
  } catch (e) {
    // fetch() só lança exceção por falha de rede real (DNS, timeout, etc.) —
    // nunca por causa de status HTTP, esses vêm no !geminiRes.ok abaixo.
    return erroCategorizado(
      "rede",
      "Não foi possível conectar ao serviço de IA. Tente novamente em instantes.",
      "Falha de rede ao chamar a API do Gemini: " + (e as Error).message,
      502,
    );
  }

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => "(sem corpo)");
    const status = geminiRes.status;
    const detalhe = `HTTP ${status} — ${errText}`;

    if (status === 429) {
      return erroCategorizado(
        "quota",
        "O assistente atingiu o limite de uso gratuito por hoje. Tente novamente mais tarde, ou use os resultados da busca por enquanto.",
        detalhe,
        429,
      );
    }
    if (status === 401 || status === 403) {
      return erroCategorizado(
        "auth",
        "O assistente está temporariamente indisponível (problema de autenticação). A equipe técnica já foi avisada.",
        detalhe,
        status,
      );
    }
    if (status === 404) {
      return erroCategorizado(
        "configuracao",
        "O assistente está temporariamente indisponível (modelo de IA não encontrado). A equipe técnica já foi avisada.",
        detalhe,
        404,
      );
    }
    if (status === 400) {
      return erroCategorizado(
        "entrada",
        "Não foi possível processar essa pergunta. Tente reformular.",
        detalhe,
        400,
      );
    }
    if (status >= 500) {
      return erroCategorizado(
        "servidor",
        "O serviço de IA está temporariamente indisponível. Tente novamente em instantes.",
        detalhe,
        502,
      );
    }
    return erroCategorizado(
      "desconhecido",
      "Não foi possível consultar o assistente agora.",
      detalhe,
      502,
    );
  }

  let data: unknown;
  try {
    data = await geminiRes.json();
  } catch (e) {
    return erroCategorizado(
      "servidor",
      "O assistente recebeu uma resposta inesperada. Tente novamente.",
      "Corpo da resposta do Gemini não é JSON válido: " + (e as Error).message,
      502,
    );
  }

  // deno-lint-ignore no-explicit-any
  const d = data as any;
  const resposta = d?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!resposta) {
    // Pode acontecer se o Gemini bloquear a resposta por segurança, etc.
    const bloqueio = d?.candidates?.[0]?.finishReason || "desconhecido";
    return erroCategorizado(
      "conteudo",
      "O assistente não conseguiu gerar uma resposta pra essa pergunta. Use os resultados da busca ou consulte os casos de atendimento.",
      "Resposta sem texto — finishReason: " + bloqueio + " | " + JSON.stringify(data).slice(0, 500),
      502,
    );
  }

  return jsonResponse({ resposta: resposta.trim() });
});
