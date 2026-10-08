# Health record

A static, read-only personal health record for clinical discussion. The site contains a symptom summary, recorded laboratory history and anonymised report attachments.

## Data

`data/labs.json` is a snapshot of recorded results, with dates, units, laboratory intervals and anonymised laboratory labels. Different known providers retain consistent anonymous labels; consumer genetic reports remain separately identified. It preserves numerical, qualitative, comparison-prefixed and missing results. The source database, personal profile, identifying report headers, private notes and legacy diagnostic interpretations are not included.

`data/case.json` distinguishes patient observations, documented findings and working hypotheses. It contains no country, age, sex, height or weight fields. The left-knee attachment is explicitly labelled a transcription; the remaining attachments are excerpts from original scan and procedure reports. Each report has an individual PDF, and the combined collection preserves all clinical pages. Patient demographics and identifying patient, clinician and provider details have been removed from the published excerpts.

The site uses laboratory reference intervals as recorded for each result. Comparisons are calculated only for exact numerical values. Charts do not substitute a threshold for results reported as less than or greater than a value. Methods and sources may differ across dates.

## Hosting

Serve the repository root as a static site. All code and assets are local, with no external scripts, fonts, analytics or database connection. GitHub Pages can publish directly from the default branch and repository root.

The page requests exclusion from search-engine indexing; this is not access control. The published site and its files are public.
