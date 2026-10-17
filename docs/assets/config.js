// ============================================================
//  CONFIGURAÇÕES DO HIRE-X — edite só este arquivo
// ============================================================
window.HIREX_CONFIG = {
  // true = modo demonstração (não chama a IA, mostra um resultado de exemplo).
  // Mude para false depois que o Worker da Cloudflare estiver publicado.
  MODO_DEMO: true,

  // Endereço do Worker da Cloudflare (ex.: "https://hire-x-api.SEU-USUARIO.workers.dev")
  API_URL: "",

  // Chave PÚBLICA do Turnstile (anti-robô). Esta pode ficar aqui, não é segredo.
  // A chave abaixo é a de teste da Cloudflare (sempre aprova).
  TURNSTILE_SITE_KEY: "1x00000000000000000000AA",

  // WhatsApp da consultora: só números, com 55 + DDD. Ex.: "5511999999999"
  WHATSAPP_NUMERO: "",

  // Links do rodapé
  LINKS: {
    politica: "https://hire-international.com/pt/politica-de-privacidade/",
    instagram: "#",
    linkedin: "#",
  },
};
