from flask import Flask, jsonify
from flask_cors import CORS
from tsne_service import tsne_bp

app = Flask(__name__)
CORS(app)

# Register blueprints
app.register_blueprint(tsne_bp)

# Add a simple health check route
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

# Make sure this doesn't conflict with any existing routes
@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "T-SNE API is running",
        "endpoints": [
            "/api/tsne/<city>"
        ]
    })

if __name__ == '__main__':
    # Change the port if 5001 conflicts with something
    app.run(debug=True, port=5002) 