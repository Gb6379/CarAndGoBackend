# Pagamentos - CarGoApp

## Tecnologia utilizada

O pagamento por **cartão de crédito** em uso real é processado pelo **PagSeguro** (UOL PagSeguro):

- **Site:** https://pagseguro.uol.com.br
- **API:** Checkout PagSeguro (o cliente é redirecionado para a página segura do PagSeguro para digitar o cartão).
- O valor é cobrado pelo PagSeguro e o dinheiro cai na **conta PagSeguro** vinculada às credenciais da aplicação.

## Para onde vai o valor

1. O cliente paga na página do PagSeguro (cartão ou boleto/PIX, conforme ofertado pelo PagSeguro no checkout).
2. O valor é creditado na **conta PagSeguro** associada ao e-mail e token configurados no backend (`PAGSEGURO_EMAIL` e `PAGSEGURO_TOKEN`).
3. A partir do **painel do PagSeguro**, você faz o saque para sua **conta bancária** (transferência para a conta cadastrada no PagSeguro).

Ou seja: **o valor é depositado na conta PagSeguro da aplicação; o saque para a conta bancária é feito pelo titular dessa conta no painel do PagSeguro.**

## Fluxo em produção (cartão de crédito)

1. Usuário clica em "Reservar Agora" → vai para a tela de pagamento.
2. Escolhe "Cartão de crédito" e clica em "Pagar com Cartão".
3. Backend cria a reserva (status pendente) e chama a API do PagSeguro para criar um checkout.
4. O frontend redireciona o usuário para a **URL de pagamento do PagSeguro** (página deles, segura).
5. O cliente digita o cartão na página do PagSeguro e conclui o pagamento.
6. O PagSeguro redireciona o cliente de volta para: `FRONTEND_URL/payment/callback?bookingId=...`
7. O PagSeguro envia uma **notificação** (webhook) para: `API_URL/payments/pagseguro/notification`
8. O backend recebe a notificação, confere o status e atualiza a reserva para **paga** e **confirmada**.

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

O fluxo de **PIX** na tela atual é **simulado**: ao clicar em "Já paguei via PIX", o backend apenas marca a reserva como paga, sem integração com gateway.

Para PIX real, é possível:

- Usar **PagSeguro** (checkout com PIX, se disponível no seu plano), ou
- Integrar outro provedor (ex.: Mercado Pago, Asaas, Pagar.me) que ofereça PIX via API.

## Resumo

| Item              | Resposta                                                                 |
|-------------------|---------------------------------------------------------------------------|
| Tecnologia        | **PagSeguro** (UOL) – checkout com redirecionamento para página deles.   |
| Onde cai o valor  | **Conta PagSeguro** ligada ao `PAGSEGURO_EMAIL` / `PAGSEGURO_TOKEN`.     |
| Saque             | Pelo **painel do PagSeguro** → transferência para a conta bancária.     |
| Uso real          | Configurar `PAGSEGURO_EMAIL`, `PAGSEGURO_TOKEN`, `FRONTEND_URL`, `API_URL` e, em produção, `PAGSEGURO_SANDBOX=false`. |
