    Checked only this file:

    /Users/maxpetrusenko/Desktop/Projects/alcohol-label-verifier/docs/Requirements-Take-Home Project_ AI-Powered Alcohol Label Verification App.docx

    Requirements from the take-home doc:

    Must have

    1. Working prototype
    - Build an AI-powered alcohol label verification app.
    - Provide a deployed application URL that evaluators can access and test.
    - Prefer a working core app over ambitious incomplete features.

    2. Source code delivery
    - Provide source code repository, e.g. GitHub or similar.
    - Include all source code.
    - Include README with setup and run instructions.
    - Include brief documentation of:
      - approach
      - tools used
      - assumptions made
      - trade-offs / limitations

    3. Core label verification flow
    - App should let a reviewer check label artwork against application/label facts.
    - It should verify common TTB-required label elements:
      - brand name
      - class/type designation
      - alcohol content, with exceptions for some wine/beer
      - net contents
      - name and address of bottler/producer
      - country of origin for imports
      - Government Health Warning Statement
    - It should handle distilled spirits example fields:
      - Brand Name: “OLD TOM DISTILLERY”
      - Class/Type: “Kentucky Straight Bourbon Whiskey”
      - Alcohol Content: “45% Alc./Vol. (90 Proof)”
      - Net Contents: “750 mL”
      - Government Warning: standard government warning text

    4. Government warning checks
    - Government Health Warning is mandatory on all alcohol beverages.
    - Warning statement must be exact / word-for-word.
    - “GOVERNMENT WARNING:” must be all caps.
    - Boldness/font/visibility matter in real review context, though prototype capability can be documented if limited.

    5. Human judgment, not blind automation
    - App should help with routine matching, but not remove reviewer judgment.
    - It should tolerate obvious equivalent matches where appropriate, e.g.:
      - “STONE’S THROW”
      - “Stone’s Throw”
    - It should avoid dumb exact-match-only behavior that creates unnecessary work.

    6. Speed
    - Results should come back in about 5 seconds.
    - Prior pilot failed because 30–40 second processing was too slow.
    - If the app is slower than manual review, agents will not use it.

    7. Usability
    - Interface must be clean and obvious.
    - No hunting for buttons.
    - Must work for mixed technical comfort levels, including older/non-technical agents.
    - Error handling matters.

    8. Standalone prototype boundary
    - Do not integrate directly with COLA for this prototype.
    - Treat it as a standalone proof of concept.
    - Production COLA integration is explicitly out of scope.

    9. Security / deployment awareness
    - Prototype should avoid doing anything risky with sensitive data.
    - Production would need PII, retention, federal compliance, auth, and security review.
    - Be aware that government networks may block outbound cloud/API calls.
    - If cloud APIs are used, document assumptions/limitations.

    10. Test labels
    - App should handle sample/distilled spirits labels.
    - Additional test labels are encouraged.
    - AI-generated label images are acceptable for test data.

    11. Evaluation criteria
    The app will be judged on:
    - Correctness and completeness of core requirements.
    - Code quality and organization.
    - Appropriate technical choices for the scope.
    - User experience and error handling.
    - Attention to requirements.
    - Creative problem-solving.

    Nice-to-haves / stakeholder wants

    1. Batch upload / batch review
    - Big importers can submit 200–300 labels at once.
    - Current manual one-at-a-time processing is painful.
    - Batch handling would be “huge.”
    - This is a strong stakeholder desire, but the doc does not make full production-scale batch infrastructure a hard deliverable.

    2. Better image handling
    - Handle imperfect label images:
      - weird angles
      - bad lighting
      - glare
      - bottle photos that are not perfectly shot
    - If AI can handle some poor-quality images, that would be valuable.
    - If not, document the limitation clearly.

    3. TTB guideline coverage beyond the sample
    - Review ttb.gov for more complete rules.
    - Support beer/wine/distilled spirits differences if feasible.
    - Alcohol content exceptions for some wine/beer are mentioned, but broad beverage-type support can be staged.

    4. Reviewer productivity features
    - Anything that reduces routine data-entry-style visual matching.
    - Clear pass/fail/review signals.
    - Highlight mismatches instead of making reviewers inspect everything manually.
    - Help agents get through queues faster without adding friction.

    5. Robust handling of judgment cases
    - Case/punctuation normalization.
    - Reasonable matching for obvious same-brand variations.
    - Avoid false rejections for harmless formatting differences.

    6. Documentation of limitations
    - Document what the prototype does not verify, especially:
      - font size
      - boldness
      - contrast
      - placement
      - bad image readability
      - production security/compliance constraints
      - cloud API/network assumptions