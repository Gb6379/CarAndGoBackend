# Resumo das alterações – 02/02/2026

## 1. Reserva e pagamento

### Reserva só após pagamento
- **Antes:** Ao clicar em "Reservar Agora", a reserva era criada na hora e depois o usuário ia para o pagamento.
- **Agora:** "Reservar Agora" só envia o usuário para a **tela de pagamento** com os dados da reserva (state). A reserva é **criada somente depois** que o usuário paga (cartão ou PIX).

### Redirecionamento para pagamento
- Ajuste para o clique em "Reservar Agora" redirecionar de fato para `/payment` (uso de `navigate` no `BookingInterface` e envio dos dados via `state`).

### Status da reserva após pagamento
- Após o pagamento (cartão ou PIX), o status da reserva passa automaticamente para **CONFIRMED** (confirmada).

---

## 2. Página de pagamento

### Fluxo da página de pagamento
- **Novo fluxo (sem reserva prévia):** A página recebe `state` (bookingPayload, vehicle, bookingSummary). O resumo é montado com esses dados. Ao clicar em "Pagar", a reserva é criada, o pagamento é processado e o usuário é redirecionado para os detalhes da reserva.
- **Fluxo com bookingId na URL:** Continua funcionando: carrega a reserva existente e permite apenas pagar.

### Ajustes de código (PaymentPage)
- Correção de erro de compilação por mistura de `??` e `||`: valores do resumo (valor base, caução, taxa) passaram a ser calculados em variáveis (`baseAmountValue`, `securityDepositValue`, `platformFeeValue`) antes do JSX.

---

## 3. Pagamento real (PagSeguro)

### Cartão de crédito em produção
- Quando **PAGSEGURO_EMAIL** e **PAGSEGURO_TOKEN** estão configurados no backend, o pagamento por **cartão** usa o **PagSeguro** de verdade:
  - Backend cria o checkout no PagSeguro e devolve `paymentUrl`.
  - Frontend redireciona o usuário para essa URL (página do PagSeguro para digitar o cartão).
  - Após o pagamento, o PagSeguro redireciona para `/payment/callback?bookingId=...` e envia notificação para o backend.
  - O valor é depositado na **conta PagSeguro** vinculada às credenciais; o saque para a conta bancária é feito no painel do PagSeguro.

### Callback e documentação
- **Página `/payment/callback`:** Exibida quando o usuário volta do PagSeguro; mostra "Pagamento confirmado" e link para os detalhes da reserva.
- **Redirect do PagSeguro:** Inclui `bookingId` na URL de retorno (`FRONTEND_URL/payment/callback?bookingId=...`).
- **PAYMENT.md:** Documento no backend explicando tecnologia (PagSeguro), em qual conta o valor cai, fluxo em produção e como ativar (credenciais, variáveis de ambiente, webhook).

### Modo simulado
- Sem credenciais do PagSeguro, o backend continua em **modo simulado**: marca a reserva como paga/confirmada sem cobrança real (para desenvolvimento/testes).

---

## 4. Dashboard e “Minhas Reservas”

### Dados reais
- O dashboard deixa de usar dados mock e passa a buscar **reservas reais** da API (`bookingService.getBookings()`).
- Filtro das reservas por usuário (lessee/lessor/both) para exibir só as reservas do usuário logado.

### Aba “Minhas Reservas”
- Lista de reservas com: veículo, datas, status (com cor), valor total.
- Separação entre “Reservas como Locatário” e “Reservas dos Meus Veículos” (quando aplicável).
- Estatísticas da visão geral passam a usar números reais (total de reservas, ativas, total gasto/ganhos).

### Exibição mesmo sem userType “ideal”
- Exibição das reservas não depende mais de `isLessee`/`isLessor`; se houver reservas para o usuário (lessee ou lessor), elas são mostradas.

---

## 5. Datas na busca e na listagem

### Um dia a menos na tela seguinte
- As datas na página de resultados (ex.: “De 02/02/2026 até 11/02/2026”) estavam sendo formatadas com `new Date().toLocaleDateString()`, o que gerava diferença por fuso.
- **Ajuste:** Formatação passou a usar a string da data (ex.: `fromDate.split('-').reverse().join('/')`) para exibir exatamente o que foi pesquisado (ex.: 03/02 até 12/02).

### Veículo aparecendo mesmo locado (Fiat Uno)
- O status do booking no banco vinha em maiúsculo (ex.: `PENDING`) e a query usava minúsculo (`pending`), então a filtragem por disponibilidade falhava.
- **Ajuste:** Uso de `LOWER(CAST(b.status AS TEXT))` nas queries de disponibilidade (busca de veículos e bloqueio de datas) para comparação case-insensitive.
- Uso de `DATE()` nas comparações de data para ignorar hora e evitar que períodos válidos fossem excluídos.

---

## 6. Datas pré-preenchidas na reserva

- Ao filtrar veículos por datas na busca e clicar em um carro, as **datas de retirada e devolução** são enviadas pela URL para a página do veículo e, em seguida, para a página de reserva.
- Na página de reserva, os campos de data e hora são **pré-preenchidos** com o intervalo pesquisado e continuam **editáveis** pelo usuário.

---

## 7. Página de detalhes da reserva

### Nova página `/booking/:id/details`
- Detalhes da reserva: veículo, período, timeline de status (pendente → confirmada → em andamento → aguardando devolução → concluída).
- Resumo do pagamento e informações do locador/locatário.
- **Ações:**  
  - Locador: aceitar/rejeitar (se pendente), confirmar devolução (se aguardando devolução).  
  - Locatário: cancelar (se pendente ou confirmada).  
  - Todos: “Ver veículo”.

### Navegação
- Na lista de viagens (TripsPage), o botão “Ver detalhes” passa a ir para `/booking/:id/details` em vez de `/bookings`.

### Ícones
- Troca de ícones inexistentes no IconSystem: `Clock` → `Schedule`, `X` → `Close`.

---

## 8. Status “Aguardando Devolução”

### Novo status
- **AWAITING_RETURN** (“Aguardando Devolução”): quando o prazo de devolução é atingido, o sistema passa a reserva para esse status até o locador confirmar a devolução.
- Após a confirmação da devolução pelo locador, o status vai para **COMPLETED**.

### Scheduler
- Job que roda a cada hora (e na subida do backend) verifica reservas **ACTIVE** ou **CONFIRMED** com `endDate` já passada e atualiza o status para **AWAITING_RETURN**.
- Uso de SQL raw com `LOWER(CAST(status AS TEXT))` para evitar erro de enum no PostgreSQL.

### Endpoints e serviços
- `POST /bookings/:id/confirm-return` – locador confirma devolução.
- `GET /bookings/lessor/:lessorId/awaiting-return` – lista reservas aguardando devolução do locador.
- Métodos no `BookingService`: `confirmReturn`, `rejectBooking`, `getPendingBookingsForLessor`, `getAwaitingReturnForLessor`, `checkAndUpdateAwaitingReturn` (com raw SQL onde necessário).

---

## 9. Enums e PostgreSQL

### Erros de enum (bookings_status_enum)
- Várias queries usavam o enum do TypeORM e quebravam no PostgreSQL (ex.: "invalid input value for enum").
- **Ajustes:** Uso de **raw SQL** com `LOWER(CAST(b.status AS TEXT))` ou `CAST(... AS TEXT)` nas condições que envolvem status (disponibilidade de veículo, blocked dates, check availability, scheduler, getPendingBookingsForLessor, getAwaitingReturnForLessor, getBookingStats).

---

## 10. TripsPage e valores

- Exibição do valor total da viagem: tratamento para `totalAmount` vindo como string ou número (uso de `typeof === 'number'` e `parseFloat` antes de `toFixed(2)`).
- Inclusão do status “Aguardando Devolução” no mapeamento de labels e cores.

---

## 11. DTO e criação de reserva (backend)

- **CreateBookingDto:** `totalAmount` e `securityDeposit` passaram a ser opcionais; o backend calcula quando não enviados.
- **BookingService.create:** Cálculo de `securityDeposit` padrão (2× diária) quando não informado; uso de `BookingStatus.CONFIRMED` ao salvar após pagamento no `PaymentService`.

---

## 12. Frontend – serviços e rotas

- **authService (bookingService):** `confirmBooking`, `rejectBooking`, `confirmReturn`, `cancelBooking`, `getPendingForLessor`, `getAwaitingReturnForLessor`.
- **paymentService:** `pay(bookingId, method, cardData?)`.
- **Rotas:** `/payment`, `/payment/callback`, `/booking/:id/details`.

---

## Arquivos principais alterados/criados

| Área            | Arquivos |
|-----------------|----------|
| Pagamento       | `PaymentPage.tsx`, `PaymentCallbackPage.tsx`, `payment.service.ts` (payWithMethod + PagSeguro), `pagseguro.service.ts` (redirectURL), `PAYMENT.md` |
| Reserva         | `BookingInterface.tsx` (não cria reserva no submit; navega para /payment com state), `BookingPage.tsx` |
| Dashboard       | `DashboardPage.tsx` (dados reais, “Minhas Reservas”, stats) |
| Detalhes reserva| `BookingDetailsPage.tsx`, `TripsPage.tsx` (link para details), `App.tsx` (rotas) |
| Datas/lista     | `VehicleListPage.tsx` (datas na URL ao clicar no carro; formatação de data sem timezone) |
| Backend         | `vehicle.service.ts` (LOWER + DATE nas queries), `booking.service.ts` (raw SQL, confirmReturn, scheduler, etc.), `booking.controller.ts` (confirm, reject, confirm-return, cancel), `create-booking.dto.ts` |
| Ícones          | `BookingDetailsPage.tsx` (Schedule, Close) |

---

*Resumo gerado em 02/02/2026.*
