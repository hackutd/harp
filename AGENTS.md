# Portal UI conventions

## Hacker-side destructive actions

Apply these conventions to hacker-facing UI under `client/portal/src/pages/hacker` and to shared components when they are rendered there.

- Use `#D14343` for final destructive confirmation actions such as reject, decline, delete, or equivalent “no” decisions. Use `#C03939` on hover and white text.
- Destructive confirmation buttons should be pill-shaped (`rounded-full`), with `h-11 px-6 font-normal` when used in an alert dialog.
- Keep the safe/cancel action neutral and pill-shaped: `h-11 rounded-full border-[#D9D9D9] px-6 font-normal hover:bg-[#F5F5F5]`.
- Hacker-side alert dialogs should use `rounded-xl border-[#E5E5E5]`, light title/body typography, and a three-unit gap between actions.
- Do not apply the destructive red to neutral choices such as “Not now,” passive status indicators, validation messages, or low-emphasis file-removal icon controls solely because their copy is negative.
- When changing one destructive confirmation, check nearby hacker-side flows for equivalent actions and keep them visually consistent.
