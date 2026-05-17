# labelcheck

CLI for LabelCheck alcohol label verification.

## Usage

```bash
npx labelcheck health
npx labelcheck verify input.json
npx labelcheck extract label.png
npx labelcheck export verify-response.json --format csv
```

By default the CLI uses `https://cola.maxpetrusenko.com`. For local development or private deployments:

```bash
LABELCHECK_BASE_URL=http://localhost:3000 npx labelcheck health
labelcheck verify input.json --base-url http://localhost:3000
```

## Verify Input

```json
{
  "application": {
    "brandName": "Frontier Glass",
    "classType": "Kentucky Straight Bourbon Whiskey",
    "alcoholContent": "45% Alc./Vol. (90 Proof)",
    "netContents": "750 mL",
    "bottlerAddress": "Frontier Glass Distilling, Louisville, KY",
    "beverageKind": "spirits",
    "imported": false
  },
  "labels": [
    {
      "labelId": "front",
      "fileName": "front.txt",
      "text": "Frontier Glass\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Frontier Glass Distilling, Louisville, KY"
    }
  ]
}
```

The hosted service is a prototype review aid, not a final compliance authority. Image extraction sends uploaded image data to the configured model provider behind the API. Use `text` input or a private `LABELCHECK_BASE_URL` for local-only demos.
