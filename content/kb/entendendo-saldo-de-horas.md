---
title: Entendendo o saldo de horas
categoria: Portal do Cliente
resumo: Como funciona o cálculo, a compensação e a validade do saldo de horas contratadas.
---

## O que é

O saldo de horas compara as **horas contratadas** (definidas por tarefa, mês
a mês) com as **horas efetivamente executadas** em chamados naquele mês.

- Se você usou menos horas do que contratou, sobra **crédito** (saldo
  positivo).
- Se você usou mais horas do que contratou, fica **débito** (saldo
  negativo).

## Compensação automática

Quando um mês fica com débito, o sistema tenta compensar automaticamente
usando créditos de meses anteriores ainda válidos — sempre pela ordem
**FIFO** (usa primeiro o crédito mais antigo disponível).

**Exemplo:** se novembro fechou com +14h de crédito e dezembro fechou com
-4h de débito, o sistema compensa automaticamente: novembro passa a mostrar
+10h (saldo líquido) e dezembro fica em 0h.

## Validade dos créditos

Créditos (saldo positivo) só podem ser usados nos **2 meses seguintes** ao
mês em que foram apurados. Depois disso, o crédito não utilizado expira e
não pode mais ser compensado.

**Exemplo:** um crédito apurado em novembro é válido pra uso em dezembro e
janeiro — expira a partir de fevereiro.

Débitos (saldo negativo), por outro lado, **nunca expiram** — ficam em
aberto até serem compensados ou pagos.

## Onde consultar

No menu lateral, clique no ícone de relógio (**Saldo**). O modal mostra o
histórico mês a mês, com saldo bruto (antes da compensação) e saldo líquido
(depois da compensação), além do saldo total disponível e o débito total,
se houver.
