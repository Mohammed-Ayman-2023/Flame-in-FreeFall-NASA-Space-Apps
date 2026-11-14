PSI-99 (SAFFIRE-II) raw folder. Files are kept exactly as received; corrections live in the loader.

- PSI-99_Experimental table_SAFFIRE-2.csv: experimental table downloaded from PSI.
- NTRS-20180005168_Table1_transcribed.csv: team transcription of NASA NTRS 20180005168 Table 1, verified against the PDF.
- PSI-99_investigation_page.txt: text of the PSI investigation page (version 5, DOI 10.60555/2chp-m469), copied 2026-11-14.
- PSI-99_Science Documents_SAFFIRE-II_Readme.docx: the readme from the PSI science documents (uploaded 2026-11-14).
- PSI-99_Readme_Table1_samples_transcribed.csv and PSI-99_Readme_Table3_diagnostics_transcribed.csv: transcriptions of
  the readme's Table 1 (samples) and Table 3 (Saffire I-III diagnostics), which are images in the document.

Known conflict: airflow for 2-6 is 20 cm/s (PSI table), 25 cm/s (NTRS paper) and 30 cm/s (readme); for 2-9 it is
20 cm/s (PSI table and paper) and 30 cm/s (readme). The loader keeps the verified paper value and logs both conflicts.
