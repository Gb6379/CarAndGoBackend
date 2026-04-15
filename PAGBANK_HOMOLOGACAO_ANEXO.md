# Anexo de Homologação - Integração PagBank (CarGoApp)

## Dados da integração

- Aplicação: **CarGoApp**
- Tipo: **Checkout PagBank (redirecionamento)**
- Backend: `https://carandgobackend-production.up.railway.app`
- Frontend: `https://www.carandgo.com.br`
- URL de notificação (webhook): `https://carandgobackend-production.up.railway.app/payments/pagseguro/notification`
- URL de retorno: `https://www.carandgo.com.br/payment/callback`

> Observação: tokens e dados sensíveis estão mascarados.

---

## 1) Criar checkout

### Requisição (para API PagBank)

```http
POST https://api.pagseguro.com/checkouts
Authorization: Bearer {{TOKEN_INTEGRACAO}}
Content-Type: application/json
```

```json
{
  "reference_id": "BOOKING_3f7e5f1f-0a4e-4f44-a22a-64eb4b4f9019",
  "customer_modifiable": true,
  "items": [
    {
      "reference_id": "3f7e5f1f0a4e4f44a22a64eb4b4f9019",
      "name": "Locacao - Fiat Mobi",
      "quantity": 1,
      "unit_amount": 85000
    }
  ],
  "payment_methods": [
    {
      "type": "PIX"
    }
  ],
  "redirect_url": "https://www.carandgo.com.br/payment/callback?bookingId=3f7e5f1f-0a4e-4f44-a22a-64eb4b4f9019",
  "return_url": "https://www.carandgo.com.br/payment/callback?bookingId=3f7e5f1f-0a4e-4f44-a22a-64eb4b4f9019",
  "notification_urls": [
    "https://carandgobackend-production.up.railway.app/payments/pagseguro/notification"
  ],
  "payment_notification_urls": [
    "https://carandgobackend-production.up.railway.app/payments/pagseguro/notification"
  ],
  "customer": {
    "name": "Gabriel Rosa",
    "email": "gabriel.am.rosa@gmail.com",
    "tax_id": "12345678909",
    "phone": {
      "country": "+55",
      "area": "11",
      "number": "999999999"
    }
  }
}
```

### Resposta esperada (sucesso)

```json
{
  "id": "CHEC_7A06F414-AC7F-4428-B27E-4BC853B8046B",
  "reference_id": "BOOKING_3f7e5f1f-0a4e-4f44-a22a-64eb4b4f9019",
  "status": "ACTIVE",
  "links": [
    {
      "rel": "PAY",
      "href": "https://pagamento.pagseguro.uol.com.br/pagamento?code=XXXX",
      "method": "GET"
    },
    {
      "rel": "SELF",
      "href": "https://api.pagseguro.com/checkouts/CHEC_7A06F414-AC7F-4428-B27E-4BC853B8046B",
      "method": "GET"
    }
  ]
}
```

### Resposta observada durante tentativa de homologação (exemplo)

```json
{
  "error_messages": [
    {
      "error": "allowlist_access_required",
      "description": "Allowlist access required. Contact PagBank."
    }
  ]
}
```

---

## 2) Consultar checkout

### Requisição (para API PagBank)

```http
GET https://api.pagseguro.com/checkouts/CHEC_7A06F414-AC7F-4428-B27E-4BC853B8046B
Authorization: Bearer {{TOKEN_INTEGRACAO}}
Content-Type: application/json
```

### Resposta esperada (exemplo)

```json
{
  "id": "CHEC_7A06F414-AC7F-4428-B27E-4BC853B8046B",
  "reference_id": "BOOKING_3f7e5f1f-0a4e-4f44-a22a-64eb4b4f9019",
  "status": "ACTIVE",
  "payment_methods": [
    {
      "type": "PIX"
    }
  ],
  "links": [
    {
      "rel": "PAY",
      "href": "https://pagamento.pagseguro.uol.com.br/pagamento?code=XXXX",
      "method": "GET"
    },
    {
      "rel": "SELF",
      "href": "https://api.pagseguro.com/checkouts/CHEC_7A06F414-AC7F-4428-B27E-4BC853B8046B",
      "method": "GET"
    }
  ]
}
```

---

## 3) Webhook de notificação (PagBank -> CarGoApp)

### Requisição recebida no endpoint

```http
POST https://carandgobackend-production.up.railway.app/payments/pagseguro/notification
Content-Type: application/json
```

```json
{
  "id": "CHEC_120301FA-8B8B-4C25-B07D-A4541EB78EB5",
  "reference_id": "BOOKING_3f7e5f1f-0a4e-4f44-a22a-64eb4b4f9019",
  "status": "INACTIVE",
  "charges": [
    {
      "id": "CHAR_F1F10115-09F4-4560-85F5-A828D9F96300",
      "status": "PAID",
      "payment_method": {
        "type": "PIX"
      },
      "amount": {
        "value": 85000,
        "currency": "BRL"
      }
    }
  ]
}
```

### Resposta do backend

```json
{
  "success": true,
  "transactionId": "CHAR_F1F10115-09F4-4560-85F5-A828D9F96300",
  "reference": "BOOKING_3f7e5f1f-0a4e-4f44-a22a-64eb4b4f9019",
  "bookingFound": true
}
```

---

## Observações finais

1. A integração utiliza **Checkout PagBank** (`/checkouts`) com redirecionamento para URL de pagamento (`rel=PAY`).
2. O backend processa retorno por callback e por webhook para atualização de status da reserva.
3. Durante tentativa em produção foi retornado erro de allowlist:
   - `allowlist_access_required`
4. Solicitamos a liberação de acesso/homologação para uso da API Checkout no ambiente da conta informada.

