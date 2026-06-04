# BloxSmith Credit Pricing

This page lists the configured credit pricing for AI models, video generation, and AI Playtest.

Owners, admins, and moderators may bypass charges in some server paths for testing. Normal users are charged from the prices below.

## Base AI Action Costs

AI text models use a multiplier. The final charge is:

`ceil(base action cost * model multiplier)`, with a minimum of 1 credit.

| Action         | Base credits |
| -------------- | -----------: |
| Chat           |            1 |
| Plan           |            1 |
| Fix            |            2 |
| Generate/build |            3 |
| Autopilot      |           10 |

## Active AI Model Prices

These are the active site model choices shown by the BloxSmith AI and Neokens model pickers.

| Provider             | Model                           | Multiplier | Chat/Plan | Fix | Generate | Autopilot |
| -------------------- | ------------------------------- | ---------: | --------: | --: | -------: | --------: |
| BloxSmith AI / Comet | `deepseek-v4-flash`             |       0.5x |         1 |   1 |        2 |         5 |
| BloxSmith AI / Comet | `grok-4.20-0309-reasoning`      |         4x |         4 |   8 |       12 |        40 |
| BloxSmith AI / Comet | `kimi-k2.6`                     |         2x |         2 |   4 |        6 |        20 |
| BloxSmith AI / Comet | `glm-5.1`                       |         2x |         2 |   4 |        6 |        20 |
| BloxSmith AI / Comet | `gemini-3.1-flash-lite-preview` |      0.75x |         1 |   2 |        3 |         8 |
| BloxSmith AI / Comet | `qwen3.5-397b-a17b`             |         3x |         3 |   6 |        9 |        30 |
| BloxSmith AI / Comet | `deepseek-v3.2`                 |         2x |         2 |   4 |        6 |        20 |
| BloxSmith AI / Comet | `gemini-3-pro-preview`          |         4x |         4 |   8 |       12 |        40 |
| BloxSmith AI / Comet | `claude-sonnet-4-6`             |         3x |         3 |   6 |        9 |        30 |
| BloxSmith AI / Comet | `claude-opus-4-7`               |         7x |         7 |  14 |       21 |        70 |
| BloxSmith AI / Comet | `claude-opus-4-8`               |        20x |        20 |  40 |       60 |       200 |
| Neokens              | `gemini-3-flash`                |         1x |         1 |   2 |        3 |        10 |
| Neokens              | `claude-haiku-4-5-20251001`     |         1x |         1 |   2 |        3 |        10 |
| Neokens              | `gpt-5.2`                       |         2x |         2 |   4 |        6 |        20 |
| Neokens              | `gpt-5.4`                       |         3x |         3 |   6 |        9 |        30 |
| Neokens              | `gpt-5.5`                       |         5x |         5 |  10 |       15 |        50 |
| Neokens              | `gpt-5.3-codex`                 |         1x |         1 |   2 |        3 |        10 |
| Neokens              | `claude-sonnet-4-6-thinking`    |         3x |         3 |   6 |        9 |        30 |
| Neokens              | `claude-opus-4-6-thinking`      |         7x |         7 |  14 |       21 |        70 |
| Neokens              | `claude-opus-4-7-thinking`      |         7x |         7 |  14 |       21 |        70 |

## Video Generation Prices

Video generation is also limited to 1 video per user per rolling week for normal users.

| Video model          | Credits |
| -------------------- | ------: |
| `sora-2-pro`         |     100 |
| `veo3.1`             |     120 |
| `grok-imagine-video` |      90 |

## AI Playtest Prices

| Playtest step              | Credits |
| -------------------------- | ------: |
| Scan and plan              |       1 |
| Apply approved fixes       |       2 |
| Verify/re-scan after fixes |       1 |

## Other Generator Prices

| Feature             |                                                     Credits |
| ------------------- | ----------------------------------------------------------: |
| Clothing generation |                                                           2 |
| Image generation    |                                             2 per variation |
| UI generation       |                                                           5 |
| Text-to-3D          |      10 by default, configurable with `TEXT_3D_CREDIT_COST` |
| Image/model-to-3D   |     25 by default, configurable with `MODEL_3D_CREDIT_COST` |
| 3D animation        | 12 by default, configurable with `ANIMATION_3D_CREDIT_COST` |

## Legacy And Fallback AI Model Aliases

These multipliers remain configured for older saved settings, fallback routes, or legacy UI ids.

| Model alias                  | Multiplier |
| ---------------------------- | ---------: |
| `gpt-5-4-nano`               |      0.35x |
| `minimax-m2-7`               |      0.65x |
| `gpt-5-4-mini`               |       0.8x |
| `gpt-5-4-pro`                |         6x |
| `gpt-5-5`                    |         4x |
| `gpt-5-5-all`                |        12x |
| `qwen3-7-max`                |       1.5x |
| `gemini-3-5-flash`           |         2x |
| `gemini-3-1-pro-preview`     |       2.5x |
| `grok-4-3`                   |         2x |
| `grok-4-2`                   |         2x |
| `deepseek-v4`                |       2.5x |
| `minimax-m3`                 |       1.5x |
| `gpt-5.4-nano`               |      0.35x |
| `minimax-m2.7`               |      0.65x |
| `qwen3.6-plus`               |      0.75x |
| `gpt-5.4-mini`               |       0.8x |
| `gpt-5.5-all`                |        12x |
| `qwen3.7-max`                |       1.5x |
| `gemini-3.5-flash`           |         2x |
| `grok-4.3`                   |         2x |
| `deepseek-v4-pro`            |       2.5x |
| `claude-haiku-4-5`           |         1x |
| `claude-opus-4-8-thinking`   |        20x |
| `claude-sonnet-4-7-thinking` |         3x |
| `gpt-5.2-codex`              |         2x |
| `gpt-5.1`                    |         1x |
| `gpt-5.1-codex`              |         1x |
| `gpt-5.1-codex-max`          |         2x |
| `gemini-3.1-pro`             |         2x |
