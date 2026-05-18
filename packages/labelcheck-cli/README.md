# labelcheck

CLI for LabelCheck alcohol label verification.

## Usage

```bash
npx labelcheck health
npx labelcheck verify ./front.png --facts ./application.json
npx labelcheck verify ./label-photos --facts ./applications.csv
npx labelcheck extract label.png
npx labelcheck export verify-response.json --format csv
```

By default the CLI uses `https://cola.maxpetrusenko.com`. For local development or private deployments:

```bash
LABELCHECK_BASE_URL=http://localhost:3000 npx labelcheck health
labelcheck verify label.png --facts application.json --base-url http://localhost:3000
```

## Verify Images

`verify` accepts an image file or a folder of images. Verification always needs source application facts:

```bash
labelcheck verify ./front.png --facts ./application.json
labelcheck verify ./label-photos --facts ./applications.csv
```

Use one `application.json` for a single source record shared by all images. Use CSV/JSON with multiple rows for batch facts; include `fileName`, `file_name`, `image`, or `image_file` when each image has different facts. Folder batches are chunked into 25-label API calls, up to 300 images.

Use `extract` when you only want image text/evidence and do not have application facts:

```bash
labelcheck extract ./front.png
labelcheck extract ./label-photos
```

Prepared JSON payloads are still supported for agents that already build `/api/v1/verify` requests.

The hosted service is a prototype review aid, not a final compliance authority. Image extraction sends uploaded image data to the configured model provider behind the API. Use `text` input or a private `LABELCHECK_BASE_URL` for local-only demos.
