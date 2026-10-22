# CashMine practical task – brief

## Context
CashMine pays users back part of the trading fees they pay on crypto exchanges. We call this payback. It is live on web, and the iOS/Android app is next. In this task you build a slice of that app: seeing payback balances and claiming them. The money is real for our users, so correctness matters more than polish.
You build it with React Native (Expo) and ship the web build, so that we can open it on a phone from a link.

## Setup constraints
- Expo app with TypeScript. Any libraries, as long as they work on web.
- Design for a phone screen, about 390 px wide. Web build only.
- API docs: docs/api.md. Treat the API as a real remote server that you call but cannot change.
- Do not put the token in code, repository or deployed build. On first open, the app asks for the token (a text field is enough), keeps it in the browser and offers a way to change it.
- Keep the API base URL in one place in the code.

## What to build (priority order; fewer things done correctly is better than everything halfway)
1. Balances (Home). Show each asset's balances, the total in USD, and how fresh the data is. Include loading, error/retry and refresh states.
2. Claim. The user picks an asset and enters an amount or taps Max. They see the fee and the amount they will receive, then confirm and submit. Afterwards they can follow the claim until it completes or fails. Validate input against the rules in the API documentation.
3. Tests. Write a few unit tests for the amount logic: parsing, validation, fee and totals.
4. Activity (if time allows). Show a paginated history of accruals, reversals and claims.

## Decisions to make and explain
- How to represent and calculate amounts.
- What the balance shows right after a claim is submitted. One user said: "I claimed and my balance didn't change, so I claimed again." Another said: "My balance dropped, then jumped back up, and I stopped trusting the app."
- What the user sees, and what the app does, when the result of a claim request is unknown, for example after a timeout.

## What they look at
- Whether money handling and the claim flow are correct
- Decisions and how they are explained
- React Native implementation and UX states on a phone screen