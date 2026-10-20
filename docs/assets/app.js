(function () {
  "use strict";

  const CFG = window.HIREX_CONFIG;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const TAMANHO_MAX_PDF = 3 * 1024 * 1024; // 3 MB (PDFs do LinkedIn costumam ter menos de 300 KB)
  const NOMES_SECOES = {
    titulo: "Título do perfil",
    sobre: "Sobre",
    experiencias: "Experiências",
    competencias: "Competências",
    idioma: "Idioma",
  };

  // ---------- Estado (fica só nesta aba do navegador) ----------
  const estado = {
    ler() {
      try { return JSON.parse(sessionStorage.getItem("hirex") || "{}"); } catch { return {}; }
    },
    salvar(dados) {
      try { sessionStorage.setItem("hirex", JSON.stringify({ ...estado.ler(), ...dados })); } catch { /* sem armazenamento */ }
    },
  };

  // ---------- Navegação entre telas ----------
  function mostrarTela(id) {
    $$(".tela").forEach((t) => { t.hidden = t.id !== id; });
    window.scrollTo(0, 0);
  }

  // ---------- WhatsApp ----------
  function linkWhatsApp(texto) {
    // Se existir um link pronto no config.js, usa exatamente ele (com a mensagem já embutida).
    if (CFG.WHATSAPP_LINK) return CFG.WHATSAPP_LINK;
    const numero = (CFG.WHATSAPP_NUMERO || "").replace(/\D/g, "");
    const base = numero ? `https://wa.me/${numero}` : "https://wa.me/";
    return `${base}?text=${encodeURIComponent(texto)}`;
  }

  function mensagemCall(nome, cargos) {
    let msg = "Olá! Acabei de fazer o Hire-X e ganhei uma análise gratuita de perfil.";
    if (nome) msg += ` Meu nome é ${nome}`;
    if (cargos) msg += ` e estou buscando vagas de ${cargos}`;
    if (nome) msg += ".";
    return msg + " Quero entender os caminhos para a minha carreira internacional.";
  }

  // ---------- Chamadas à API ----------
  async function chamarApi(caminho, corpo) {
    if (CFG.MODO_DEMO) return simularApi(caminho, corpo);
    let resp;
    try {
      resp = await fetch(CFG.API_URL.replace(/\/$/, "") + caminho, { method: "POST", body: corpo });
    } catch {
      throw { mensagem: "Não conseguimos conectar. Verifique sua internet e tente novamente." };
    }
    let dados = {};
    try { dados = await resp.json(); } catch { /* resposta vazia */ }
    if (!resp.ok) throw { codigo: dados.codigo, mensagem: dados.mensagem || "Algo deu errado. Tente novamente em instantes." };
    return dados;
  }

  // ---------- Turnstile (anti-robô) ----------
  let turnstileToken = "";
  let turnstileWidget = null;

  function carregarTurnstile() {
    if (CFG.MODO_DEMO || turnstileWidget !== null || window.__turnstileCarregando) return;
    window.__turnstileCarregando = true;
    window.onTurnstileLoad = function () {
      turnstileWidget = window.turnstile.render("#captcha", {
        sitekey: CFG.TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        language: "pt-br",
        callback: (t) => { turnstileToken = t; },
        "expired-callback": () => { turnstileToken = ""; },
        "error-callback": () => { turnstileToken = ""; },
      });
    };
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad";
    s.async = true;
    document.head.appendChild(s);
  }

  function reiniciarTurnstile() {
    turnstileToken = "";
    if (window.turnstile && turnstileWidget !== null) window.turnstile.reset(turnstileWidget);
  }

  // ---------- Modal ----------
  const modal = $("#modal");
  let focoAnterior = null;

  function abrirModal() {
    focoAnterior = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    carregarTurnstile();
    setTimeout(() => modal.querySelector("input").focus(), 50);
  }

  function fecharModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
    if (focoAnterior) focoAnterior.focus();
  }

  $$("[data-abrir-modal]").forEach((b) => b.addEventListener("click", abrirModal));
  $$("[data-fechar-modal]").forEach((b) => b.addEventListener("click", fecharModal));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) fecharModal(); });

  // ---------- Máscara de WhatsApp ----------
  const campoWhats = $('#form-cadastro [name="whatsapp"]');
  campoWhats.addEventListener("input", () => {
    const v = campoWhats.value;
    if (v.trim().startsWith("+")) return; // número internacional: não mascara
    const d = v.replace(/\D/g, "").slice(0, 11);
    let r = d;
    if (d.length > 2) r = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) r = `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
    campoWhats.value = r;
  });

  function mostrarErro(el, msg) {
    el.textContent = msg;
    el.hidden = !msg;
  }

  // ---------- Passo 1: cadastro ----------
  // Os envios usam clique no botão (e Enter nos campos), não o "submit" do formulário:
  // assim funcionam também dentro de pré-visualizações que bloqueiam formulários.
  function aoEnviar(form, botao, acao) {
    let enviando = false;
    const rodar = async () => {
      if (enviando) return;
      enviando = true;
      try { await acao(form); } finally { enviando = false; }
    };
    form.addEventListener("submit", (e) => e.preventDefault());
    botao.addEventListener("click", rodar);
    form.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox") {
        e.preventDefault();
        rodar();
      }
    });
  }

  aoEnviar($("#form-cadastro"), $("#botao-continuar"), async (form) => {
    const erro = $("#erro-cadastro");
    const nome = form.nome.value.trim();
    const email = form.email.value.trim();
    const whatsapp = form.whatsapp.value.trim();
    const digitos = whatsapp.replace(/\D/g, "");

    if (nome.length < 2) return mostrarErro(erro, "Digite seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return mostrarErro(erro, "Digite um e-mail válido.");
    if (digitos.length < 10 || digitos.length > 15) return mostrarErro(erro, "Digite um WhatsApp válido, com DDD.");
    if (!form.consentimento.checked) return mostrarErro(erro, "Para continuar, marque a autorização de uso dos dados.");
    if (!CFG.MODO_DEMO && !turnstileToken) return mostrarErro(erro, "Aguarde a verificação de segurança e tente de novo.");
    mostrarErro(erro, "");

    const botao = $("#botao-continuar");
    botao.disabled = true;
    botao.textContent = "Enviando…";
    try {
      const dados = await chamarApi("/api/lead", JSON.stringify({ nome, email, whatsapp, consentimento: true, turnstile: turnstileToken }));
      estado.salvar({ token: dados.token, nome: dados.primeiroNome || nome.split(" ")[0] });
      fecharModal();
      irParaUpload();
    } catch (err) {
      if (err.codigo === "ja_usado") { fecharModal(); return mostrarJaUsado(); }
      mostrarErro(erro, err.mensagem);
      reiniciarTurnstile();
    } finally {
      botao.disabled = false;
      botao.textContent = "Continuar";
    }
  });

  // ---------- Passo 2: upload ----------
  const campoPdf = $("#campo-pdf");
  const areaUpload = $("#upload-area");
  const textoUpload = $("#upload-texto");
  const TEXTO_UPLOAD_PADRAO = textoUpload.innerHTML;

  function irParaUpload() {
    $$("[data-nome]").forEach((el) => { el.textContent = estado.ler().nome || "Perfeito"; });
    mostrarTela("tela-upload");
  }

  function atualizarArquivo() {
    const arquivo = campoPdf.files[0];
    if (arquivo) {
      textoUpload.textContent = "";
      const forte = document.createElement("strong");
      forte.textContent = "✓ " + arquivo.name;
      textoUpload.append(forte, document.createElement("br"), "Clique para trocar o arquivo");
      areaUpload.classList.add("upload--ok");
    } else {
      textoUpload.innerHTML = TEXTO_UPLOAD_PADRAO;
      areaUpload.classList.remove("upload--ok");
    }
  }
  campoPdf.addEventListener("change", atualizarArquivo);

  ["dragenter", "dragover"].forEach((ev) => areaUpload.addEventListener(ev, (e) => { e.preventDefault(); areaUpload.classList.add("upload--ativo"); }));
  ["dragleave", "drop"].forEach((ev) => areaUpload.addEventListener(ev, () => areaUpload.classList.remove("upload--ativo")));
  areaUpload.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      campoPdf.files = e.dataTransfer.files;
      atualizarArquivo();
    }
  });

  aoEnviar($("#form-upload"), $("#botao-analisar"), async () => {
    const erro = $("#erro-upload");
    const arquivo = campoPdf.files[0];
    const cargos = $("#campo-cargos").value.trim();

    if (!arquivo) return mostrarErro(erro, "Escolha o PDF do seu LinkedIn.");
    if (arquivo.type !== "application/pdf" && !/\.pdf$/i.test(arquivo.name)) return mostrarErro(erro, "O arquivo precisa ser um PDF.");
    if (arquivo.size > TAMANHO_MAX_PDF) return mostrarErro(erro, "O arquivo é grande demais. Envie o PDF exportado direto do LinkedIn.");
    if (cargos.length < 2) return mostrarErro(erro, "Conte para quais cargos você está aplicando.");
    mostrarErro(erro, "");

    const corpo = new FormData();
    corpo.append("token", estado.ler().token || "");
    corpo.append("cargos", cargos);
    corpo.append("pdf", arquivo);

    mostrarTela("tela-carregando");
    const parar = animarEtapas();
    try {
      const dados = await chamarApi("/api/analisar", corpo);
      estado.salvar({ resultado: dados.resultado, cargos });
      mostrarResultado();
    } catch (err) {
      if (err.codigo === "ja_usado") return mostrarJaUsado();
      if (err.codigo === "sessao_invalida") {
        estado.salvar({ token: null });
        mostrarTela("tela-inicio");
        return abrirModal();
      }
      mostrarTela("tela-upload");
      mostrarErro(erro, err.mensagem);
    } finally {
      parar();
    }
  });

  function animarEtapas() {
    const itens = $$("#etapas li");
    let i = 0;
    itens.forEach((li) => li.classList.remove("ativa", "feita"));
    itens[0].classList.add("ativa");
    const timer = setInterval(() => {
      if (i >= itens.length - 1) return;
      itens[i].classList.replace("ativa", "feita");
      i += 1;
      itens[i].classList.add("ativa");
    }, 9000);
    return () => clearInterval(timer);
  }

  // ---------- Tela 3: resultado ----------
  // Todo texto da IA entra com textContent (nunca innerHTML) para evitar injeção de código.
  function el(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function mostrarResultado() {
    const { resultado: r, nome, cargos } = estado.ler();
    if (!r) return mostrarTela("tela-inicio");

    $("#res-abertura").textContent = cargos
      ? `${nome}, você pode avançar nos processos seletivos para ${cargos} se fizer alguns ajustes:`
      : `${nome}, você pode avançar nos processos seletivos se fizer alguns ajustes:`;

    // Quadro: vermelhos primeiro, depois amarelos, depois verdes.
    const ordem = { vermelho: 0, amarelo: 1, verde: 2 };
    const notasOrdenadas = [...r.notas].sort((a, b) => (ordem[a.status] ?? 3) - (ordem[b.status] ?? 3));
    const notas = $("#res-notas");
    notas.replaceChildren(...notasOrdenadas.map((n) => {
      const li = el("li");
      li.append(el("span", `ponto ponto--${n.status}`), el("span", "notas__secao", NOMES_SECOES[n.secao] || n.secao), el("span", "notas__resumo", n.resumo));
      return li;
    }));

    const pontos = $("#res-pontos");
    pontos.replaceChildren(...r.pontos.map((p) => {
      const li = el("li");
      const vimos = el("p");
      vimos.append(el("span", "rotulo", "O que vimos"), document.createTextNode(p.o_que_vimos));
      const perde = el("p");
      perde.append(el("span", "rotulo perde", "O que você perde"), document.createTextNode(p.o_que_voce_perde));
      li.append(el("h4", null, p.titulo), vimos, perde);
      return li;
    }));

    const fortes = r.pontos_fortes || [];
    $("#res-fortes-box").hidden = fortes.length === 0;
    $("#res-fortes").replaceChildren(...fortes.map((f) => el("li", null, f)));

    $("#res-agravamento").textContent = r.agravamento;
    $("#botao-whatsapp").href = linkWhatsApp(mensagemCall(nome, cargos));

    mostrarTela("tela-resultado");
  }

  function mostrarJaUsado() {
    mostrarTela("tela-ja-usado");
  }

  // ---------- Modo demonstração ----------
  function simularApi(caminho) {
    return new Promise((resolve) => {
      if (caminho === "/api/lead") return setTimeout(() => resolve({ token: "demo" }), 600);
      setTimeout(() => resolve({ resultado: RESULTADO_DEMO }), 6000);
    });
  }

  const RESULTADO_DEMO = {
    tipo: "diagnostico",
    abertura: "Julia, seu perfil tem boa experiência em vendas, mas hoje ele ainda não aparece para recrutadores de fora do Brasil.",
    notas: [
      { secao: "titulo", status: "vermelho", resumo: "Frases genéricas, sem termos buscáveis" },
      { secao: "sobre", status: "amarelo", resumo: "Curto e sem conquistas" },
      { secao: "experiencias", status: "amarelo", resumo: "Bons números, pouco contexto" },
      { secao: "competencias", status: "vermelho", resumo: "Só habilidades genéricas" },
      { secao: "idioma", status: "verde", resumo: "Perfil todo em inglês" },
    ],
    pontos: [
      { titulo: "Título não aparece nas buscas", o_que_vimos: "Seu título usa frases como “Passionate about Growth”, que ninguém pesquisa.", o_que_voce_perde: "Quando um recrutador busca pelo seu cargo, outros perfis aparecem antes do seu." },
      { titulo: "Competências genéricas demais", o_que_vimos: "Suas competências são “Communication” e “Negotiation”, sem ferramentas ou métodos.", o_que_voce_perde: "Os filtros dos recrutadores não encontram você pelo que você realmente sabe fazer." },
      { titulo: "Sobre não mostra resultados", o_que_vimos: "O Sobre tem duas frases e não cita nenhuma conquista.", o_que_voce_perde: "O recrutador não entende em 10 segundos o seu nível e por que deveria te chamar." },
    ],
    pontos_fortes: [
      "Suas experiências trazem números reais, como os US$ 2M em receita.",
      "Seu perfil já está em inglês, o que é essencial para vagas internacionais.",
    ],
    agravamento: "Com o seu histórico em vendas B2B, você poderia estar recebendo mensagens de recrutadores internacionais para vagas de Account Executive. Mas, do jeito que o perfil está hoje, essas oportunidades em euro e dólar estão indo para outras pessoas.",
  };

  // ---------- Inicialização ----------
  $$("[data-ano]").forEach((e) => { e.textContent = new Date().getFullYear(); });
  $$("[data-link]").forEach((a) => { a.href = (CFG.LINKS && CFG.LINKS[a.dataset.link]) || "#"; });
  $$("[data-whatsapp-geral]").forEach((a) => { a.href = linkWhatsApp("Olá! Já fiz o Hire-X e quero conversar sobre o meu perfil."); });

  const inicial = estado.ler();
  if (inicial.resultado) mostrarResultado();
  else if (inicial.token) irParaUpload();
  else mostrarTela("tela-inicio");
})();
