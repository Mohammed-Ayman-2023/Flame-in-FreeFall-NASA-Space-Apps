from dotenv import load_dotenv

load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

model = ChatGoogleGenerativeAI(model="gemini-3.1-flash-lite")
embeddings = GoogleGenerativeAIEmbeddings(model="gemini-embedding-2")

if __name__ == "__main__":
    ...