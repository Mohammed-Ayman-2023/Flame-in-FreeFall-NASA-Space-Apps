from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_chroma import Chroma

from gemini import embeddings

import time
import sys

DATABASE_DIRECTORY = r"../database"

def store_markdown(filepath : str, database: Chroma, batch_size: int, pause_duration: float | int) -> None:
    """
    Reads the text file given and splits the data into batches using a text splitter.
    Then stores all the contents of each batch in the vector database, To respect the rate limits of
    the embeddings model a pause duration is set between each batch

    :param filepath: The path to the file to be read
    :param database: The Chroma database
    :param batch_size: The size of each batch to be processed
    :param pause_duration: the duration between each store in seconds
    """
    try:
        with open(filepath, "r", encoding="utf-8") as file:
            content = file.read()

        headers_to_split_on = [
            ("#", "Header 1"),
            ("##", "Header 2"),
            ("###", "Header 3"),
        ]

        markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
        sections = markdown_splitter.split_text(content)

        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=150
        )

        splits = text_splitter.split_documents(sections)

        print("Starting The Storing Process")
        print("-----------------------------------------------")

        for i in range(0, len(splits), batch_size):
            batch = splits[i:i + batch_size]

            print(f"Uploading batch {i // batch_size + 1} (Chunks {i} to {i + len(batch)}) out of {len(splits) // batch_size}")

            database.add_documents(batch)

            print(f"Batch done. Sleeping for {pause_duration} seconds to respect rate limits...")
            print("-----------------------------------------------")

            if i + batch_size < len(splits):
                time.sleep(pause_duration)
            else:
                print("Finished uploading final batch!")

        print(f"Successfully stored in {DATABASE_DIRECTORY}")
    except FileNotFoundError:
        sys.exit(f"File Not Found In The Provided Path {filepath}")

vectorstore = Chroma(
    collection_name="NasaSpaceApps",
    embedding_function=embeddings,
    persist_directory=DATABASE_DIRECTORY
)

retriever = vectorstore.as_retriever(search_type="similarity", search_kwargs={"k": 10})

if __name__ == "__main__":

    store_markdown(
        filepath="../data/reports/text/PSI-25.txt",
        database=retriever,
        batch_size=5,
        pause_duration=5
    )

    print("Finished")