# Fingerprint Verification Module

A production-ready biometric fingerprint verification module integrated into the OneVote backend.

---

## Features

- **Preprocessing**: Grayscale + contrast normalization + 4-factor quality checks (blur, contrast, size, flat image)
- **Extraction**: Crossing Number minutiae extraction with Zhang-Suen thinning (pure JS, zero native deps)
- **Matching**: Spatial minutiae pair matching with best-of-N multi-template strategy
- **Encryption**: AES-GCM-256 with unique IV per template record
- **Logging**: Full audit trail per attempt (sessionId, voterId, score, threshold, failureReason, etc.)
- **Multiple templates per finger**: Enroll 2–3 samples per finger for higher accuracy

---

## Setup

### 1. Add to your `.env`

```env
FINGERPRINT_MATCH_THRESHOLD=40
FINGERPRINT_ENCRYPTION_KEY=<64-hex-chars>
```

Generate a key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Run database migration

```bash
npx prisma migrate dev --name add_fingerprint_models
npx prisma generate
```

### 3. Run tests

```bash
npx jest src/fingerprint --verbose
```

---

## API

### POST `/fingerprint/enroll`

Enroll a fingerprint image for a voter.

**Form-data:**
| Field | Type | Required |
|---|---|---|
| `file` | JPG/PNG image | ✅ |
| `voterId` | string | ✅ |
| `fingerLabel` | `LEFT_INDEX` \| `RIGHT_INDEX` \| `LEFT_THUMB` \| `RIGHT_THUMB` \| `LEFT_MIDDLE` \| `RIGHT_MIDDLE` | ✅ |
| `imageRef` | string (audit path) | optional |
| `deviceId` | string | optional |

**Example response:**
```json
{
  "success": true,
  "templateId": "f3b2a...",
  "fingerLabel": "RIGHT_INDEX",
  "qualityScore": 78,
  "templateVersion": "sourcefis-v1",
  "sessionId": "uuid"
}
```

---

### POST `/fingerprint/verify`

Verify a live scan against all enrolled templates for a voter+finger.

**Form-data:**
| Field | Type | Required |
|---|---|---|
| `file` | JPG/PNG image | ✅ |
| `voterId` | string | ✅ |
| `fingerLabel` | (see above) | ✅ |
| `sessionId` | string | ✅ |
| `deviceId` | string | optional |

**Example response (match):**
```json
{
  "matched": true,
  "score": 75.5,
  "threshold": 40,
  "qualityScore": 84,
  "matchedTemplateId": "f3b2a...",
  "failureReason": null
}
```

**Example response (no match):**
```json
{
  "matched": false,
  "score": 12.3,
  "threshold": 40,
  "qualityScore": 71,
  "matchedTemplateId": null,
  "failureReason": "MATCH_SCORE_BELOW_THRESHOLD"
}
```

---

### GET `/fingerprint/logs/:sessionId`

Retrieve all audit log entries for a verification session.

**Example response:**
```json
[
  {
    "id": "uuid",
    "sessionId": "abc123",
    "voterId": "voter-uuid",
    "fingerLabel": "RIGHT_INDEX",
    "status": "FAILED",
    "qualityScore": 71,
    "matchScore": 12.3,
    "threshold": 40,
    "failureReason": "MATCH_SCORE_BELOW_THRESHOLD",
    "extractorUsed": "sourcefis",
    "matchedTemplateId": null,
    "timestamp": "2026-03-26T17:00:00.000Z"
  }
]
```

---

## Failure Reasons

| Code | Meaning |
|---|---|
| `IMAGE_TOO_BLURRY` | Laplacian variance below threshold |
| `LOW_CONTRAST` | Pixel range too narrow |
| `IMAGE_TOO_SMALL` | Width or height below 100px |
| `FINGER_REGION_NOT_FOUND` | Flat/empty image (near-zero std dev) |
| `TEMPLATE_EXTRACTION_FAILED` | Too few minutiae detected |
| `MATCH_SCORE_BELOW_THRESHOLD` | Score below configured threshold |
| `NO_ENROLLED_TEMPLATES` | No active templates for voter+finger |
| `INTERNAL_ERROR` | Image decode failure |

---

## Architecture

```
src/fingerprint/
├── fingerprint.module.ts          # NestJS module
├── fingerprint.controller.ts      # REST endpoints
├── fingerprint.service.ts         # Orchestration
├── fingerprint.constants.ts       # Enums + constants
├── dto/
│   ├── enroll-fingerprint.dto.ts
│   └── verify-fingerprint.dto.ts
├── services/
│   ├── fingerprint-preprocessor.service.ts   # Quality check + grayscale
│   ├── fingerprint-extractor.service.ts      # Minutiae extraction (CN algorithm)
│   ├── fingerprint-matcher.service.ts        # Spatial pair matching
│   └── fingerprint-log.service.ts            # Audit logging
├── utils/
│   └── crypto.util.ts   # AES-GCM-256 per-record encryption
└── tests/
    ├── preprocessor.spec.ts
    └── matcher.spec.ts
```
