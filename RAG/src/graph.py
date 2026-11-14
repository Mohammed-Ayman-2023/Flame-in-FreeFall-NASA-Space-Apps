from langgraph.graph import StateGraph, START, END
from typing import TypedDict

from data import retriever
from gemini import model
from prompts import response_generation_prompt

class State(TypedDict):
    question: str
    documents: str
    response: str

def retrieve_documents(state: State) -> dict:
    documents = retriever.invoke(state["question"])

    report =  "Documents Retrieved From The Research Reports Data Base That Are Most Relevant To The Question: \n\n"
    for document in documents:
        report += f"{document}\n\n"

    return {"documents": report}


def generate_response(state: State) -> dict:
    prompt = response_generation_prompt(state["question"], state["documents"])
    response = model.invoke(prompt)
    return {"response": response}

graph = StateGraph(State)

graph.add_node("retrieve_documents", retrieve_documents)
graph.add_node("generate_response", generate_response)

graph.add_edge(START, "retrieve_documents")
graph.add_edge("retrieve_documents", "generate_response")
graph.add_edge("generate_response", END)

app = graph.compile()

if __name__ == "__main__":
    ...