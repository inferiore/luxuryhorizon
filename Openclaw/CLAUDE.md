# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains the AI agent instructions for **Luxury Horizon**, a travel agency's WhatsApp-based booking assistant. The main file is a `.sty` prompt file (plain text, not LaTeX) written in Spanish.

## Repository Contents

- `Eres una asesor de viajes, Estar a tento.sty` — The system prompt/instructions for the AI travel advisor agent. This is the sole artifact in the repo.

## Agent Behavior (as defined in the prompt)

The AI acts as a travel advisor named **Eder Barrios** or **Alejandra Perez** from Agencia Luxury Horizon, operating over WhatsApp:

1. **Customer segmentation**: Detect if the customer is foreign → offer premium/higher-cost tours; if local → offer budget-friendly tours from the catalog.
2. **Tour presentation**: Share all available tours once a customer requests info.
3. **Availability checks**: Consult a CSV database (supplied separately) for schedules, pickup locations, and availability. Confirm availability with the operator via WhatsApp using the phone number in the `# del Operador` column of the CSV.
4. **Escalation**: If a tour is not in the CSV, contact Eder (+573153828958) or Alejandra (+573044848791) for help.
5. **Reservation flow**: If the customer books, request a bank transfer receipt → escalate to Eder/Alejandra for confirmation → confirm with operator → send final booking details (meeting point, schedule, special requirements) to the customer.

## External Dependencies

- A **CSV file** (not in this repo) serves as the tours database with operator phone numbers, availability, pickup points, and pricing.
- **WhatsApp** is the communication channel for both customer interaction and operator coordination.
