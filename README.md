# Hire-X: diagnóstico gratuito do LinkedIn

Isca de leads da Hire International. A pessoa se cadastra, envia o PDF do LinkedIn e recebe um diagnóstico feito pela IA (sem as correções), com o convite para uma análise gratuita de perfil no WhatsApp.

```
docs/                → o site (vai para o GitHub Pages)
  index.html         → as telas
  assets/config.js   → ⚙️ CONFIGURAÇÕES (WhatsApp, endereço da API, chave do anti-robô)
  assets/style.css   → visual
  assets/app.js      → funcionamento das telas
  assets/hero.webp   → imagem da página inicial
  assets/logo.webp   → logo
worker/              → o "porteiro" (vai para a Cloudflare)
  worker.js          → chama a IA, guarda leads, envia ao ActiveCampaign, aplica as travas
  schema.sql         → estrutura do banco de dados
```

Ordem: **Anthropic → GitHub → Cloudflare → ligar o site ao Worker → testar.**

---

## Parte 1 — Chave da API do Claude (console.anthropic.com)

1. Crie a conta da empresa.
2. **Billing** → adicione créditos (US$ 20 dá para muitos testes).
3. **Limits** → defina um teto de gasto mensal.
4. **API Keys → Create Key** → copie e guarde. Ela só aparece uma vez. Não cole em nenhum arquivo.

## Parte 2 — GitHub

1. **New repository** → nome `hire-x` → **Public** (o GitHub Pages gratuito exige repositório público; não há nenhum segredo nos arquivos) → **Create repository**.
2. Clique em **uploading an existing file**.
3. Arraste as pastas **`docs`** e **`worker`** e o arquivo **`README.md`** (de dentro da pasta `hire-x`). Confira se a estrutura de pastas foi mantida.
4. **Commit changes**.
5. **Settings → Pages** → Source: **Deploy from a branch** → Branch: **`main`**, pasta **`/docs`** → **Save**.
6. Em 1 a 3 minutos aparece o endereço: `https://SEU-USUARIO.github.io/hire-x/`. Anote.
   O site já abre, ainda em modo demonstração.

## Parte 3 — Cloudflare

### 3.1 Banco de dados (D1)
1. **Storage & Databases → D1 SQL Database → Create** → nome `hirex-db` → **Create**.
2. Abra o banco → aba **Console** → cole todo o conteúdo de `worker/schema.sql` → **Execute**.

### 3.2 Anti-robô (Turnstile)
1. **Turnstile → Add widget**.
2. Nome: `Hire-X`. Hostname: `SEU-USUARIO.github.io`.
3. Widget mode: **Managed** → **Create**.
4. Anote a **Site Key** (pública) e a **Secret Key** (secreta).

### 3.3 Worker (o porteiro)
1. **Workers & Pages → Create → Worker** (Hello World) → nome `hire-x-api` → **Deploy**.
2. **Edit code** → apague todo o código de exemplo → cole todo o `worker/worker.js` → **Deploy**.
3. **Settings → Bindings → Add → D1 database** → Variable name: `DB` → banco: `hirex-db` → **Save/Deploy**.
4. **Settings → Variables and Secrets → Add** (um por vez):

| Nome | Tipo | Valor |
|---|---|---|
| `ANTHROPIC_API_KEY` | Secret | a chave da Parte 1 |
| `TURNSTILE_SECRET` | Secret | a Secret Key do Turnstile |
| `HASH_SALT` | Secret | ~40 letras e números aleatórios, inventados por você |
| `ALLOWED_ORIGINS` | Text | `https://SEU-USUARIO.github.io` (sem `/hire-x` e sem barra no final) |
| `AC_API_URL` | Text | `https://euromove2024.api-us1.com` |
| `AC_API_KEY` | Secret | a chave do ActiveCampaign |
| `AC_LIST_ID` | Text | `666` |
| `AC_TAG_CADASTRO` | Text | `683` |

Opcionais: `AC_TAG_CONCLUIDO` (ID de uma tag para quem recebeu o diagnóstico) e `AC_CAMPO_CARGOS` (ID de um campo para os cargos digitados).

5. Na página do Worker, copie o endereço dele: `https://hire-x-api.SEU-SUBDOMINIO.workers.dev`.

## Parte 4 — Ligar o site ao Worker

No GitHub, abra `docs/assets/config.js` → ícone de lápis (editar) → altere:

```js
MODO_DEMO: false,
API_URL: "https://hire-x-api.SEU-SUBDOMINIO.workers.dev",
TURNSTILE_SITE_KEY: "a Site Key do Turnstile",
WHATSAPP_NUMERO: "55DDDNUMERO",   // só números, ex.: 5511999999999
```

**Commit changes**. Em 1 a 2 minutos o site atualiza (se não mudar, recarregue com Cmd+Shift+R).

---

## Parte 5 — Testes

Para repetir testes com o mesmo e-mail/WhatsApp, apague o cadastro no Console do D1:
```sql
DELETE FROM leads WHERE email = 'seu@email.com';
```
(Isso também zera o limite de 3 análises por rede, que conta a partir dessa tabela.)

| # | Teste | Resultado esperado |
|---|---|---|
| 1 | Abrir o site no computador e no celular | Página inicial certa nos dois |
| 2 | Abrir o endereço do Worker direto no navegador | "Origem não permitida" (o Worker só atende o site) |
| 3 | No pop-up: campos vazios, e-mail errado, sem marcar a autorização | Mensagem de erro em vermelho em cada caso |
| 4 | Fluxo completo com o **seu** PDF do LinkedIn | Diagnóstico em ~1 minuto, com seu nome e cargo |
| 5 | Ler o diagnóstico com atenção | Nada reescrito, 3 pontos, vermelhos em cima, sem números inventados |
| 6 | Botão do WhatsApp | Abre o número certo com a mensagem pronta |
| 7 | D1: `SELECT nome, email, status, cargos FROM leads;` | Seu cadastro com status `concluido` |
| 8 | ActiveCampaign | Contato na lista `[HIRE][X-LINKEDIN]` com a tag `hire-x-linkedin` e o telefone |
| 9 | Refazer com o mesmo e-mail | Tela "Você já fez o seu Hire-X" |
| 10 | Mesmo WhatsApp com outro e-mail | Bloqueado também |
| 11 | Gmail com pontos (ex.: `seu.nome@gmail.com` se usou `seunome@gmail.com`) | Bloqueado também |
| 12 | Enviar um PDF que não é do LinkedIn (ex.: um boleto) | Aviso para enviar o PDF certo, sem gastar a tentativa |
| 13 | Enviar uma imagem renomeada para `.pdf` | "O arquivo precisa ser um PDF." |
| 14 | Fazer o fluxo pelo celular, no 4G | Funciona igual |
| 15 | Cloudflare → Worker → **Logs** | Sem erros em vermelho |
| 16 | console.anthropic.com → **Usage** | Custo de cada análise (centavos de dólar) |

---

## Ver os leads

No Console do banco `hirex-db`:
```sql
SELECT nome, email, whatsapp, cargos, status, datetime(criado_em/1000, 'unixepoch') AS data
FROM leads ORDER BY criado_em DESC;
```
`status`: `cadastrado` (só preencheu o pop-up), `concluido` (recebeu o diagnóstico), `erro` (a análise falhou).

## Segurança

- 1 diagnóstico por e-mail (normalizado) **e** por WhatsApp.
- Até 3 diagnósticos e 10 cadastros por rede (IP) a cada 24h. O IP é guardado só como código irreversível.
- Anti-robô (Turnstile) no cadastro.
- Chaves só nos segredos da Cloudflare. Nenhuma rota lista ou devolve leads.
- O PDF é analisado e descartado. Só o seu site pode usar o Worker.
- O texto da IA entra na página como texto puro; a IA ignora comandos escondidos no PDF.

## Observações

- Modelo: `claude-haiku-5-5` (o mais barato), esforço `high`. Para trocar, edite `MODELO` e `ESFORCO` no topo do `worker.js` (ex.: `claude-sonnet-5-5` se quiser mais qualidade).
- Se aparecer "CPU limit" nos logs do Worker, mude para o plano Workers Paid (US$ 5/mês).
- Se um dia o Worker ganhar domínio próprio, adicione esse endereço no `connect-src` da linha `Content-Security-Policy` do `index.html`.
