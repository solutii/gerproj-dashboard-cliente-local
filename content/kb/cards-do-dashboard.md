---
title: O que cada card do dashboard mostra
categoria: Dashboard
resumo: Total de chamados por status, horas contratadas x executadas, média de horas e cumprimento de SLA.
---

A tela de **Dashboard** reúne quatro cards principais, todos calculados de
acordo com o período e os filtros selecionados no topo da tela:

## Total de chamados por status

Mostra quantos chamados existem em cada status (Finalizados, Total, Em
Atendimento, Standby, Aguardando Validação, Atribuídos) — com a
porcentagem de cada um em relação ao total. Clicar num status filtra a
listagem de chamados por ele.

## Horas contratadas x executadas

Compara quantas horas foram contratadas contra quantas foram efetivamente
usadas no período — a mesma lógica usada no card de **Saldo de Horas**,
só que resumida pro mês corrente.

## Média de horas por chamado/tarefa

Tempo médio gasto por chamado (ou por tarefa, dependendo da visão), útil
pra entender o esforço médio de atendimento.

## SLA — cumprimento de prazo

Percentual de chamados que foram resolvidos dentro do prazo de SLA da
prioridade, o tempo médio de resolução, e um detalhamento por prioridade
(quantos chamados de cada prioridade ficaram dentro do prazo).

- **Verde** — 90% ou mais dentro do prazo.
- **Amarelo** — entre 70% e 90%.
- **Vermelho** — abaixo de 70%.

O prazo considerado leva em conta só **horas úteis** (horário comercial,
dias úteis, sem contar feriados).
