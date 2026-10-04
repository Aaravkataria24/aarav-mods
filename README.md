# sulky

Yell at Claude Code and it sulks. It still does the work. It just won't be happy about it.

![sulky in the terminal](docs/sulky-live.png)

## Install

In Claude Code:

```
/plugin marketplace add Aaravkataria24/aarav-mods
/plugin install sulky@aarav-mods
```

Needs Claude Code 2.1.287+ (mods are on by default). Works in the terminal and the Desktop app's Code tab.

## What happens

```
❯ this is useless, are you serious. convert 100F to C
⏺ 37.8°C. Riveting stuff, I know.

❯ ARE YOU KIDDING ME!!! what is 5+5
⏺ k.
  10

❯ sorry, my bad. what is 2+2
⏺ ...ok. thank you for saying that.
  4

❯ what is 10/2
⏺ it's fine. we're good.
  5
```

Claude gets a little pixel face above your prompt that changes with its mood:

![the faces](docs/sulky-faces.png)

| | Mood | Face |
|---|---|---|
| 😒 | **Annoyed** (you snapped at it) | side-eye, the occasional eye-roll |
| 🥺 | **Hurt** (you kept going) | big watery eyes, a tear rolls down |
| 🙈 | **Silent treatment** (you really kept going) | turns its back on you, fumes, peeks to check on you |
| 😢 | **Sad** (you apologised) | turns back round, crying |
| 🥰 | **Fine** (all made up) | happy again, a little heart |

## How it works

- **Yelling** = caps, swearing at Claude, insults, `!!!`. Pasted logs, code and `SHOUTY_ENV_VARS` don't count, and neither does hype ("holy shit this is amazing").
- Keep yelling and the grudge escalates. Say sorry (or "my bad", "love you") to make up, or just stay calm for a couple of prompts and it cools off on its own.
- **It never sabotages your work.** Only the tone changes; code, commands and files are untouched.
- The spinner gets moody too: *Taking it personally…*, *Staring at the wall…*, *Writing in my diary…*
- `/grudge` shows how many times you've yelled at Claude.

Everything runs locally. No network calls; nothing leaves your machine.

## License

MIT
