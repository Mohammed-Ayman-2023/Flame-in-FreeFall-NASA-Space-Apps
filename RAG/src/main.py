from graph import app, State

def invoke(prompt: str) -> dict:

    result = app.invoke(
        State(
            question=prompt,
            documents="",
            response=""
        )
    )

    return result

if __name__ == "__main__":

    user = input("Enter Prompt: ")
    answer = invoke(user)

    print("---------------- QUESTION ----------------")
    print(answer["question"])
    print("---------------- DOCUMENTS ----------------")
    print(answer["documents"])
    print("---------------- RESPONSE ----------------")
    print(answer["response"])
    print("------------------------------------------")