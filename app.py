import html
import random
import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

API_URL = "https://opentdb.com/api.php"
DIFFICULTIES = {"easy", "medium", "hard"}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/questions")
def get_questions():
    try:
        amount = min(20, max(1, int(request.args.get("amount", 5))))
    except ValueError:
        amount = 5

    params = {"amount": amount}

    category = request.args.get("category", "")
    if category.isdigit():
        params["category"] = category

    difficulty = request.args.get("difficulty", "")
    if difficulty in DIFFICULTIES:
        params["difficulty"] = difficulty

    try:
        response = requests.get(API_URL, params=params, timeout=10)
    except requests.RequestException:
        return jsonify({"error": "Couldn't reach the trivia service."}), 502

    if response.status_code == 429:
        return jsonify({"error": "Too many requests. Wait a few seconds and try again."}), 429

    if response.status_code != 200:
        return jsonify({"error": "Failed to retrieve questions."}), 502

    results = response.json().get("results", [])

    
    if not results:
        return jsonify({"error": "Not enough questions for that combination. Try fewer questions or a different category."}), 404

    questions = []

    for q in results:
        answers = [html.unescape(a) for a in q["incorrect_answers"]]
        correct = html.unescape(q["correct_answer"])
        answers.append(correct)
        random.shuffle(answers)

        questions.append({
            "category": html.unescape(q["category"]),
            "difficulty": q["difficulty"],
            "question": html.unescape(q["question"]),
            "answers": answers,
            "correct": correct,
            "correct_index": answers.index(correct),
        })

    return jsonify(questions)

if __name__ == "__main__":
    app.run(debug=True)