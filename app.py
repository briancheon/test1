import json
import os
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)
app.secret_key = os.urandom(24)

QUESTIONS_FILE = os.path.join(os.path.dirname(__file__), "questions.json")
POINTS_CORRECT = 10
POINTS_INCORRECT = -3
QUIZ_DURATION = 60  # seconds


def load_questions():
    with open(QUESTIONS_FILE) as f:
        return json.load(f)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/quiz")
def quiz():
    return render_template("quiz.html")


@app.route("/api/questions")
def get_questions():
    questions = load_questions()
    # Strip answers before sending to client
    sanitized = [
        {"id": q["id"], "question": q["question"], "options": q["options"]}
        for q in questions
    ]
    return jsonify({
        "questions": sanitized,
        "duration": QUIZ_DURATION,
        "points_correct": POINTS_CORRECT,
        "points_incorrect": POINTS_INCORRECT,
    })


@app.route("/api/submit", methods=["POST"])
def submit_answers():
    data = request.get_json()
    user_answers = data.get("answers", {})  # {question_id: chosen_answer}

    questions = load_questions()
    answer_map = {str(q["id"]): q["answer"] for q in questions}

    score = 0
    results = []
    for q in questions:
        qid = str(q["id"])
        chosen = user_answers.get(qid)
        correct = answer_map[qid]
        is_correct = chosen == correct

        if chosen is not None:
            score += POINTS_CORRECT if is_correct else POINTS_INCORRECT

        results.append({
            "id": q["id"],
            "question": q["question"],
            "chosen": chosen,
            "correct": correct,
            "is_correct": is_correct,
        })

    answered = sum(1 for r in results if r["chosen"] is not None)
    return jsonify({"score": score, "results": results, "answered": answered, "total": len(questions)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
