---
title: Como usar os filtros do dashboard
categoria: Dashboard
resumo: Mês, ano, cliente, recurso e status — como cada filtro afeta os cards e gráficos.
---

No topo da tela de **Dashboard**, você encontra os filtros que controlam
todos os cards e gráficos abaixo:

- **Ano** e **Mês** — período de referência dos dados. Cards de totais,
  horas contratadas x executadas e SLA são sempre calculados dentro desse
  período.
- **Cliente** — em contas de consultor (ADM), permite trocar qual cliente
  está sendo visualizado, sem precisar fazer login de novo.
- **Recurso** — filtra os dados só pelos chamados atendidos por um consultor
  específico.
- **Status** — filtra por status do chamado (ex: só "FINALIZADO", ou
  "TODOS").

## Efeito em cascata

Trocar o cliente no filtro do dashboard também atualiza:

- O card de **Saldo de Horas**.
- O dropdown de **Cliente** no formulário de abertura de chamado (quando
  logado como ADM) — reflete automaticamente o cliente selecionado no
  filtro, sem precisar escolher de novo.

## Limpar filtros

O botão de limpar filtros (ícone de borracha) reseta tudo pro padrão —
útil quando você perde o fio da meada depois de aplicar vários filtros
combinados.
