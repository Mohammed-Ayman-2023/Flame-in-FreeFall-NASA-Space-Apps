from pathlib import Path
import pymupdf4llm
import trafilatura

PDF_DIRECTORY = Path("../data/reports/pdf")
TEXT_DIRECTORY = Path("../data/reports/text")
FAILED_DIRECTORY = Path("../data/reports/failed")
WEB_DIRECTORY = Path("../data/web")

if not TEXT_DIRECTORY.exists() or not PDF_DIRECTORY.exists():
    raise RuntimeError(f"Directory {TEXT_DIRECTORY} or {PDF_DIRECTORY} is missing. Please make sure to create it first.")

def extract(path: str | Path):
    path = Path(path)
    text = pymupdf4llm.to_markdown(str(path), use_ocr=False)

    with open(f"{TEXT_DIRECTORY}/{path.stem}.txt", "w", encoding="utf-8") as file:
        file.write(text)

def extract_all():
    for file in PDF_DIRECTORY.iterdir():
        if file.is_file() and file.suffix.lower() == ".pdf":
            print(f"Extracting Text From Pdf File {file}")
            try:
                extract(file)
            except Exception as exception:
                file.replace(FAILED_DIRECTORY / file.name)
                print(f"Skipping File {file.name}, Encountered An Exception While Parsing\nException: {exception}")
                continue

def extract_webpage(url: str, destination_name: str) -> None:

    data = trafilatura.fetch_url(url)

    if not data:
        raise RuntimeError(f"Could not fetch {url}")

    markdown = trafilatura.extract(
        data,
        output_format="markdown",
        include_links=True,
        include_images=False,
        favor_precision=True,
        include_tables=True
    )

    with open(f"{WEB_DIRECTORY}/{destination_name}.md", "w", encoding="utf-8") as file:
        file.write(markdown)

if __name__ == "__main__":
    extract_webpage("https://spinoff.nasa.gov/node/9918", "NewTech")