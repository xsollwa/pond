# Pond intelligence evaluation — legacy-keyword-baseline

Corpus: 2026-09-24.1 · 150 cases · split: all
Fixture digest: 5801fb446898a27f4eadb3399f0e21309b5319f989ffbc1e2345abae433348d8

Curated PageRepresentation; not extractor output
Original synthetic diagnostic scenarios, labeled by the implementation author. No independent annotation or real-world accuracy claim. Reserved split is visible source, not an independently held-out benchmark. Gold PageRepresentations isolate analysis; HTML is reserved for extraction evaluation in Phase 3.

| Metric                                                  | Result                 |
| ------------------------------------------------------- | ---------------------- |
| Primary leaf accuracy (120 civic cases)                 | 0.8%                   |
| Primary parent accuracy                                 | 23.3%                  |
| Strict multi-label precision / recall / micro-F1        | 1.9% / 0.7% / 1.0%     |
| Strict multi-label macro-F1                             | 1.7%                   |
| Hierarchical precision / recall / micro-F1              | 68.5% / 13.0% / 21.9%  |
| Civic detection precision / recall                      | 88.0% / 36.7%          |
| Unknown / non-civic / insufficient status accuracy      | 100.0% / 0.0% / 100.0% |
| Provider/schema failures                                | 0                      |
| Top-score ECE (exact / parent; uncalibrated diagnostic) | 62.8% / 11.4%          |

Legacy broad categories are mapped only to matching parent nodes; the bridge does not invent leaf predictions. All-label metrics count unsupported extra labels as false positives. An abstention with no predicted labels has undefined precision, not perfect precision. Provider failures count as missed civic predictions and incorrect status decisions. The JSON report includes confusion matrices, confidence bins and split-level metrics. No cloud model was called.

| Expected domain       | Cases | Leaf accuracy | Parent accuracy |
| --------------------- | ----- | ------------- | --------------- |
| civil_rights          | 22    | 0.0%          | 0.0%            |
| democracy             | 8     | 0.0%          | 37.5%           |
| economic_security     | 20    | 0.0%          | 0.0%            |
| education             | 6     | 0.0%          | 33.3%           |
| environment           | 8     | 0.0%          | 37.5%           |
| healthcare            | 11    | 0.0%          | 72.7%           |
| housing               | 12    | 0.0%          | 25.0%           |
| immigration           | 7     | 0.0%          | 28.6%           |
| insufficient          | 2     | n/a           | n/a             |
| justice_public_safety | 7     | 14.3%         | 28.6%           |
| labor                 | 7     | 0.0%          | 0.0%            |
| not_civic             | 20    | n/a           | n/a             |
| reproductive_rights   | 5     | 0.0%          | 40.0%           |
| transportation        | 7     | 0.0%          | 42.9%           |
| unknown               | 8     | n/a           | n/a             |

| Fixture format tag | Cases | Parent accuracy | Status accuracy |
| ------------------ | ----- | --------------- | --------------- |
| blog               | 22    | 33.3%           | 45.5%           |
| forum              | 21    | 37.5%           | 42.9%           |
| government         | 21    | 25.0%           | 33.3%           |
| news               | 22    | 16.7%           | 22.7%           |
| organization       | 21    | 11.8%           | 23.8%           |
| reddit             | 22    | 16.7%           | 40.9%           |
| social             | 21    | 23.5%           | 42.9%           |

## Reported failure patterns

- food-diabetes: expected economic_security.food_insecurity; got healthcare (0.77).
- race-medical: expected civil_rights.racial_discrimination; got healthcare (0.58).
- gender-medical: expected civil_rights.gender_discrimination; got healthcare (0.58).
- food-insurance-noise: expected economic_security.food_insecurity; got healthcare (0.83).
- race-nutrition: expected civil_rights.racial_discrimination; got healthcare (0.53).
