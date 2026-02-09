# Verificação do locador (CPF e antecedentes) para anunciar veículo

## Comportamento atual

- Para **anunciar um veículo**, o locador precisa ter **documentos verificados** (`documentsVerified = true`).
- O fluxo de verificação está em **Conta > Verificação**: o usuário clica em **"Validar CPF e antecedentes"**.
- O backend valida o CPF (formato e lista interna) e consulta **antecedentes criminais** (implementação simulada). Se tudo estiver OK, marca `documentsVerified = true`.
- Se o locador tentar anunciar sem estar verificado, o front redireciona para a página de Verificação; o `POST /vehicles` retorna **403** com mensagem pedindo para completar a verificação.

## Uso de APIs do governo

**Sim, é possível** integrar com APIs oficiais para CPF e antecedentes. Hoje o backend **não** chama essas APIs; usa validação de formato e mocks. Abaixo está o que existe no governo e como evoluir.

### 1. CPF (Cadastro Base do Cidadão)

- **Catálogo:** [Cadastro Base do Cidadão (CPF) — Conecta](https://www.gov.br/conecta/catalogo/apis/cadastro-base-do-cidadao-cbc-cpf)
- **Fonte:** Receita Federal; base com dados de brasileiros/estrangeiros/falecidos.
- **Uso:** Consultar situação cadastral e dados do CPF.
- **Acesso:** Plataforma **Conecta Gov.br** (gestão de acesso e credenciais).

### 2. Antecedentes criminais

- **Catálogo:** [Certidão de Antecedentes Criminais — Conecta](https://www.gov.br/conecta/catalogo/apis/antecedentes-criminais)
- **Fonte:** Ministério da Justiça e Segurança Pública (SINIC).
- **Retorno:** Informações sobre decisões condenatórias com trânsito em julgado; "Nada consta" quando não há registros.
- **Parâmetros típicos:** nome completo, CPF, nome da mãe, data de nascimento, nome do pai.
- **Acesso:** Também via Conecta Gov.br.

### 3. Como obter acesso (Conecta Gov.br)

1. Acessar o **gestor de acesso:**  
   [gestor.conectagov.estaleiro.serpro.gov.br](https://gestor.conectagov.estaleiro.serpro.gov.br/)
2. Cadastrar o órgão/empresa e solicitar acesso às APIs desejadas (CPF e Antecedentes).
3. Após deferimento, usar **OAuth 2** para obter token e chamar os endpoints (produção/homologação conforme documentação do Conecta).
4. **Firewall:** Para primeira integração, pode ser necessário cadastrar os IPs do seu ambiente (conectar@economia.gov.br).

### 4. CNH (validação)

- **Não existe** uma API pública simples só para “validar número da CNH”.
- Opções em uso no ecossistema:
  - **Login GOV.BR com CNH digital:** o usuário se autentica com Gov.br; o backend pode usar o retorno do login para considerar “identidade/CNH verificada” no fluxo.
  - **Serpro Datavalid:** validação de identidade digital (leitura de QR Code da CNH, prova de vida, etc.); acesso via contratação/credenciais Serpro.

O módulo atual **gov-br** já gera URL de autorização GOV.BR e troca código por token; pode ser estendido para, após login bem-sucedido, considerar uma etapa de “identidade verificada” (e eventualmente exigir isso antes de marcar `documentsVerified` ou de liberar anúncio).

## Resumo

| O que              | Hoje no sistema                         | APIs reais (Gov.br) |
|--------------------|------------------------------------------|----------------------|
| CPF                | Validação de formato + blacklist mock   | Conecta – Cadastro Base do Cidadão (CPF) |
| Antecedentes       | Mock (lista fixa por CPF)                | Conecta – Certidão de Antecedentes Criminais |
| CNH                | Não validada                             | Gov.br login e/ou Serpro Datavalid (contratado) |

Para **produção** com dados reais de CPF e antecedentes, é necessário cadastrar no Conecta Gov.br, obter credenciais e substituir no backend as chamadas mock pelas chamadas às APIs do catálogo (CPF e Antecedentes). A exigência de verificação para anunciar veículo já está implementada; falta apenas a integração com essas APIs.
