import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import joblib
import numpy as np

app = FastAPI(title='KRATOS AI Health Engine')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

model_path = os.path.join(os.path.dirname(__file__), 'conveyor_models.pkl')
try:
    model_bundle = joblib.load(model_path)
    clf = model_bundle['classifier']
    reg = model_bundle['regressor']
    version = model_bundle['version']
    print(f'Successfully loaded model bundle version: {version}')
except Exception as e:
    raise RuntimeError(f'Failed to load models from {model_path}: {e}')

class Telemetry(BaseModel):
    vibration_g: float = Field(..., description='RMS Vibration in g')
    current_amps: float = Field(..., description='Motor Current in Amps')
    temperature_c: float = Field(..., description='Temperature in Celsius')

@app.get('/')
@app.get('/health')
def health_check():
    return {'status': 'healthy', 'model_version': version, 'ai_available': True}

@app.post('/predict')
def predict_health(data: Telemetry):
    try:
        features = np.array([[data.vibration_g, data.current_amps, data.temperature_c]])
        
        status = clf.predict(features)[0]
        confidence = float(max(clf.predict_proba(features)[0]) * 100)
        rul = float(reg.predict(features)[0])
        
        return {
            'status': status,
            'confidence': round(confidence, 1),
            'rul_days': round(rul, 1),
            'model_version': version,
            'ai_available': True
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='127.0.0.1', port=8000)
