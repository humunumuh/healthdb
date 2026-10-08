# Health record

A static, read-only personal health record for clinical discussion. The site contains recorded laboratory history, a scan viewer, anonymised report attachments and a symptom summary.

## Data

`data/labs.json` is a snapshot of recorded results, with dates, units, laboratory intervals and anonymised laboratory labels. Different known providers retain consistent anonymous labels; consumer genetic reports remain separately identified. It preserves numerical, qualitative, comparison-prefixed and missing results. The source database, personal profile, identifying report headers, private notes and legacy diagnostic interpretations are not included.

`data/case.json` distinguishes patient observations, documented findings and working hypotheses. It contains no country, age, sex, height or weight fields. The left-knee attachment is explicitly labelled a transcription; the remaining attachments are excerpts from original scan and procedure reports. Each report has an individual PDF, and the combined collection preserves all clinical pages. Patient demographics and identifying patient, clinician and provider details have been removed from the published excerpts.

The site uses laboratory reference intervals as recorded for each result. Comparisons are calculated only for exact numerical values. Charts do not substitute a threshold for results reported as less than or greater than a value. Methods and sources may differ across dates.

`data/scans.json` lists nine studies: six MRIs (right knee from September 2026 and September 2025, left knee, right hand/wrist, right shoulder and right elbow), two hand X-ray studies and a thoracic/lumbar spine X-ray study. The viewer contains 32 browsing sequences and 919 source-windowed, 8-bit PNG display copies. Images retain their native dimensions. The exports contain no image metadata or DICOM headers. Every frame was screened for visible text and reviewed visually before release. Small operator codes outside the anatomy were removed from four X-ray display copies; laterality and position labels were preserved. Original scans are unchanged and are not included in this repository. The viewer supports slice browsing, zoom, pan and links to the selected study, series and slice; it does not provide source-pixel windowing or calibrated measurements. Images load as needed when the scan section is viewed.

## Hosting

Serve the repository root as a static site. All code and assets are local, with no external scripts, fonts, analytics or database connection. GitHub Pages can publish directly from the default branch and repository root.

The page requests exclusion from search-engine indexing; this is not access control. The published site and its files are public.
