# Pagamentos - CarGoApp

## Tecnologia utilizada

O pagamento em uso real é processado pelo **Checkout PagBank** (redirecionamento para página segura do PagBank/PagSeguro):

- **Site:** https://pagbank.com.br / https://pagseguro.uol.com.br
- **API atual do projeto:** `POST /checkouts` em `https://sandbox.api.pagseguro.com` (sandbox) e `https://api.pagseguro.com` (produção).
- **Autenticação:** token Bearer de integração da conta (`PAGSEGURO_TOKEN`), com `PAGSEGURO_SANDBOX=true|false`.
- O valor é cobrado pelo PagBank e cai na **conta PagBank/PagSeguro** vinculada às credenciais da aplicação.

## Para onde vai o valor

1. O cliente paga na página de checkout do PagBank/PagSeguro (cartão, PIX, boleto conforme habilitado).
2. O valor é creditado na **conta PagSeguro** associada ao e-mail e token configurados no backend (`PAGSEGURO_EMAIL` e `PAGSEGURO_TOKEN`).
3. A partir do **painel PagBank/PagSeguro**, você faz o saque para sua **conta bancária**.

Ou seja: **o valor é depositado na conta PagBank/PagSeguro da aplicação; o saque para a conta bancária é feito pelo titular dessa conta no painel.**

## Fluxo em produção (cartão de crédito)

1. Usuário clica em "Reservar Agora" → vai para a tela de pagamento.
2. Escolhe "Cartão de crédito" e clica em "Pagar com Cartão".
3. Backend cria a reserva (status pendente) e chama a API do Checkout PagBank para criar um checkout.
4. O frontend redireciona o usuário para a **URL de pagamento** retornada em `links[rel=PAY]` pelo PagBank.
5. O cliente conclui o pagamento na página segura do PagBank/PagSeguro.
6. O PagSeguro redireciona o cliente de volta para: `FRONTEND_URL/payment/callback?bookingId=...`
7. O PagBank envia uma **notificação** (webhook) para: `API_URL/payments/pagseguro/notification`
8. O backend recebe a notificação, confere o status e atualiza a reserva para **paga** e **confirmada**.

---

## Passo a passo: testar o checkout em **desenvolvimento** (local)

Use este fluxo quando o código roda no seu PC (`localhost`). A integração atual do CarGoApp é o **Checkout PagBank API** (redirecionamento): o backend chama `https://sandbox.api.pagseguro.com/checkouts` em sandbox e `https://api.pagseguro.com/checkouts` em produção, enviando `Authorization: Bearer <token>`.

### 1) Onde pegar as credenciais certas (sandbox)

| O quê | Onde pegar | Onde colocar |
|--------|------------|--------------|
| **E-mail do vendedor (sandbox)** | PagBank **Sandbox** → **Perfis de integração** → **Vendedor** → bloco **Credenciais** → E-mail | `PAGSEGURO_EMAIL` no `backend/.env` |
| **Token do vendedor (sandbox)** | Mesma tela → **Token** (copiar) | `PAGSEGURO_TOKEN` no `backend/.env` |
| **Comprador de testes** (quando aplicável ao sandbox) | **MEU SANDBOX** → **Comprador de testes** | **Não** vai no `.env`. Serve só para testar a experiência de pagamento no ambiente sandbox |

**Importante:** use o token de integração da conta no ambiente correto (sandbox/prod). Se gerar um novo token, o antigo pode ser invalidado.

### 2) Arquivo de configuração do backend (local)

Edite apenas **`backend/.env`** (não commite tokens; use `.gitignore`).

Exemplo mínimo para **sandbox local**:

```env
PAGSEGURO_EMAIL=seu_email_vendedor_sandbox@exemplo.com
PAGSEGURO_TOKEN=SEU_TOKEN_DO_PERFIL_VENDEDOR_SANDBOX
PAGSEGURO_SANDBOX=true

FRONTEND_URL=http://localhost:3001
API_URL=http://localhost:3000
```

Regras:

- **Não** deixe **duas linhas** `PAGSEGURO_EMAIL` ou `PAGSEGURO_TOKEN` no mesmo arquivo — a última sobrescreve e você acha que configurou uma coisa e o Node lê outra.
- `FRONTEND_URL` e `API_URL` **sem barra no final** (o código também normaliza, mas evite duplicar `//`).
- Depois de salvar o `.env`, **reinicie** o backend (`Ctrl+C` e `npm run start:dev` de novo).

### 3) Dados do usuário logado

Para o checkout atual, o backend pode enviar os dados do cliente quando disponíveis (nome, e-mail, documento e telefone), mas o fluxo segue mesmo com campos opcionais ausentes porque o checkout permite preenchimento na página transacional.

### 4) Frontend local apontando para o backend

No repositório, o `web-app` usa API **`http://localhost:3000`** quando você abre o site em `localhost` (ver `web-app/src/services/authService.ts`). O backend Nest deve estar na **porta 3000** (padrão do `backend/.env` `PORT=3000`) ou você precisa alterar essa constante no front.

### 5) Webhook (notificação) em desenvolvimento — o ponto que mais confunde

O PagSeguro precisa chamar:

`POST {API_URL}/payments/pagseguro/notification`

Na sua máquina, `http://localhost:3000` **não é acessível da internet**, então o PagSeguro **não consegue** enviar a notificação, a menos que você use um **túnel**.

**Opção recomendada (ngrok ou similar):**

1. Com o backend rodando na porta 3000, suba o túnel, por exemplo: `ngrok http 3000`.
2. Copie a URL HTTPS pública (ex.: `https://abc123.ngrok-free.app`).
3. No **`backend/.env`**, defina:  
   `API_URL=https://abc123.ngrok-free.app`  
   (mesma URL que o túnel mostra, **sem** path no final).
4. No **painel sandbox** (área de configurações do vendedor / notificação de transações), cadastre:  
   `https://abc123.ngrok-free.app/payments/pagseguro/notification`  
5. Reinicie o backend.

Assim o `notificationURL` enviado na criação do checkout e a URL do painel ficam **coerentes** com o que o PagSeguro consegue alcançar.

**Opção só para ver a página de pagamento:** você pode testar o **redirecionamento** para o PagSeguro com `API_URL=http://localhost:3000`, mas a **confirmação automática** da reserva via webhook tende a **não funcionar** até existir URL pública.

### 6) Página de retorno após pagar (sandbox)

No painel sandbox, em **Página de redirecionamento**, use:

`http://localhost:3001/payment/callback`

(O app já envia `?bookingId=...` na criação do checkout; manter essa URL alinhada ao `FRONTEND_URL` evita inconsistência.)

Na parte **“redirecionamento com código da transação”**, em geral **deixe vazio** — o CarGoApp hoje identifica a reserva pelo **`bookingId`**, não pelo código da transação do PagSeguro.

### 7) Rodar os serviços e testar

1. Banco Postgres ligado (conforme seu `backend/.env`).
2. Pasta **`backend`**: `npm run start:dev`.
3. Pasta **`web-app`**: subir o front (ex.: `npm start`) e abrir `http://localhost:3001`.
4. Faça login com usuário que tem CPF.
5. **Reservar Agora** → você vai para **`/payment`**.
6. **Continuar com PIX** (ou cartão) → o navegador deve ir para **`sandbox.pagseguro.uol.com.br`**.
7. Na tela do PagSeguro, use o **comprador de testes** (e-mail/senha do sandbox) se pedir login.

### 8) Se ainda der erro

- Confira no terminal do backend a mensagem completa (400/500).
- Confirme de novo: **`PAGSEGURO_SANDBOX=true`**, token **do Vendedor sandbox**, **sem** variáveis duplicadas.
- Se aparecer erro de PagSeguro genérico, valide **túnel** + `API_URL` + URL de notificação no painel.

---

## Passo a passo: checkout em **produção**

### 1) Credenciais de produção

| O quê | Onde pegar | Onde colocar |
|--------|------------|--------------|
| **E-mail da conta** | Conta **PagBank/PagSeguro real** (mesmo login do vendedor) | `PAGSEGURO_EMAIL` |
| **Token de integração** | PagBank → **Venda online** → **Integrações** → **Gerar token** (ou enviar por e-mail) | `PAGSEGURO_TOKEN` |

Documentação oficial (produção vs sandbox de token): [Token de autenticação – PagBank Developers](https://developer.pagbank.com.br/docs/token-de-autenticacao).

### 2) Variáveis de ambiente no **servidor** (ex.: Railway)

Configure no painel do provedor **todas** as variáveis do **serviço que roda o Nest** (não basta só o `.env` local):

```env
PAGSEGURO_EMAIL=email_da_conta_producao@exemplo.com
PAGSEGURO_TOKEN=TOKEN_PRODUCAO
PAGSEGURO_SANDBOX=false

FRONTEND_URL=https://www.SEU_DOMINIO.com.br
API_URL=https://SEU_BACKEND_PUBLICO.exemplo.com
```

- `API_URL` = URL **pública HTTPS** do backend **sem** barra no final.
- `FRONTEND_URL` = URL **pública HTTPS** do site onde o usuário navega.
- Após alterar variáveis no provedor, faça **redeploy** ou **restart** do serviço.

### 3) Painel PagBank (produção)

- **Notificação de transação / URL de notificação:**  
  `https://SEU_BACKEND_PUBLICO/payments/pagseguro/notification`
- **Página de redirecionamento:**  
  `https://www.SEU_DOMINIO.com.br/payment/callback`

Isso deve bater com o que o backend monta usando `API_URL` e `FRONTEND_URL`.

### 4) Deploy do frontend

O site em produção deve chamar o **backend de produção**. No código atual, qualquer host que **não** é `localhost` usa o backend Railway configurado em `authService.ts` — se mudar de domínio ou API, ajuste essa URL no front e faça novo build/deploy.

### 5) Teste controlado

Faça um pagamento de **valor baixo**, confira:

- redirecionamento de volta para `/payment/callback?bookingId=...`;
- logs do backend recebendo `POST /payments/pagseguro/notification`;
- reserva atualizada para paga/confirmada quando a notificação for processada.

### 6) Segurança

- Não commite `.env` com token.
- Não publique print com token em canais públicos; se vazar, **gere novo token** no painel.

---

## Como ativar pagamento real (PagSeguro)

### 1. Ter uma conta PagSeguro

- Acesse https://pagseguro.uol.com.br e crie uma conta ou use a existente.
- Complete o cadastro e vincule uma **conta bancária** para saque (no painel do PagSeguro).

### 2. Obter as credenciais da API

- No painel do PagSeguro: **Integrações** → **Chaves da API** (ou equivalente).
- Você recebe:
  - **E-mail** (o e-mail da conta PagSeguro usado na API).
  - **Token** (token de integração).

Para testes, use o **ambiente de sandbox** do PagSeguro e as chaves de **sandbox** (e-mail e token de teste).

### 3. Configurar variáveis no backend

No `.env` ou no ambiente onde o backend roda (ex.: Railway, Heroku), defina:

```env
# PagSeguro
PAGSEGURO_EMAIL=seu-email@cadastrado-no-pagseguro.com
PAGSEGURO_TOKEN=TOKEN_QUE_VOCE_COPIOU_NO_PAINEL
PAGSEGURO_SANDBOX=true

# URLs (para redirect e webhook)
FRONTEND_URL=https://seu-dominio-frontend.com
API_URL=https://seu-dominio-backend.com
```

- **Produção:** use `PAGSEGURO_SANDBOX=false` e as credenciais **reais**.
- **Sandbox:** use `PAGSEGURO_SANDBOX=true` e as credenciais de **teste** do PagSeguro.

### 4. Webhook (notificação) do PagSeguro

O PagSeguro precisa conseguir acessar sua API pela internet:

- `API_URL` deve ser uma URL **pública** (ex.: `https://api.seudominio.com`).
- A rota de notificação é: `POST {API_URL}/payments/pagseguro/notification?...`
- No painel do PagSeguro, configure a **URL de notificação** se for obrigatório (depende do tipo de integração).

Sem essas variáveis configuradas, o backend usa **modo simulado**: não chama o PagSeguro e apenas marca a reserva como paga/confirmada para testes.

## PIX

Com `PAGSEGURO_EMAIL` e `PAGSEGURO_TOKEN` configurados, o botão de PIX também usa checkout real do PagSeguro:

1. Frontend chama `POST /payments/pay` com `method = pix`.
2. Backend cria checkout no PagSeguro.
3. Frontend redireciona para `paymentUrl`.
4. Cliente conclui o PIX no ambiente seguro do PagSeguro.

Sem PagSeguro configurado, o sistema permanece em modo simulado (desenvolvimento).

## Split por locador/plataforma

No fluxo atual (checkout padrão PagSeguro v2), o valor é recebido pela conta vinculada às credenciais da aplicação (`PAGSEGURO_EMAIL` / `PAGSEGURO_TOKEN`).

Ou seja:

- Não há split automático por locador neste fluxo.
- Para split real por recebedor (locador + plataforma), é necessário evoluir para uma integração com suporte nativo a split/multi-recebedor (ou outro gateway que ofereça essa funcionalidade).

## Resumo

| Item              | Resposta                                                                 |
|-------------------|---------------------------------------------------------------------------|
| Tecnologia        | **PagSeguro** (UOL) – checkout com redirecionamento para página deles.   |
| Onde cai o valor  | **Conta PagSeguro** ligada ao `PAGSEGURO_EMAIL` / `PAGSEGURO_TOKEN`.     |
| Saque             | Pelo **painel do PagSeguro** → transferência para a conta bancária.     |
| Uso real          | Configurar `PAGSEGURO_EMAIL`, `PAGSEGURO_TOKEN`, `FRONTEND_URL`, `API_URL` e, em produção, `PAGSEGURO_SANDBOX=false`. |
