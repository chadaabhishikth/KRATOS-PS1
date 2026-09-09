import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

print('1. Generating Degradation Trajectories...')
np.random.seed(42)
data = []

# Simulate 100 machines running to failure over 42-60 days
for machine_id in range(100):
    lifespan = np.random.randint(42, 60)
    for day in range(lifespan):
        rul = lifespan - day
        
        # Physics-informed degradation: exponential increase as RUL approaches 0
        degradation_factor = np.exp(-rul / 15) 
        
        vib = 0.5 + (degradation_factor * 3.0) + np.random.normal(0, 0.2)
        curr = 12.0 + (degradation_factor * 10.0) + np.random.normal(0, 0.5)
        temp = 35.0 + (degradation_factor * 45.0) + np.random.normal(0, 2.0)
        
        if rul > 20: status = 'GREEN'
        elif rul > 7: status = 'YELLOW'
        else: status = 'RED'
            
        data.append([vib, curr, temp, rul, status])

df = pd.DataFrame(data, columns=['vibration_g', 'current_amps', 'temperature_c', 'rul_days', 'status'])

print('2. Training Classifier (Status) and Regressor (RUL)...')
X = df[['vibration_g', 'current_amps', 'temperature_c']]
y_status = df['status']
y_rul = df['rul_days']

X_train, X_test, ys_train, ys_test, yr_train, yr_test = train_test_split(
    X, y_status, y_rul, test_size=0.2, random_state=42, stratify=y_status
)

classifier = RandomForestClassifier(n_estimators=100, max_depth=8, class_weight='balanced', random_state=42)
classifier.fit(X_train, ys_train)

regressor = RandomForestRegressor(n_estimators=100, max_depth=8, random_state=42)
regressor.fit(X_train, yr_train)

print(f'Classifier Accuracy: {classifier.score(X_test, ys_test) * 100:.2f}%')
print(f'Regressor R^2 Score: {regressor.score(X_test, yr_test):.4f}')

output_path = os.path.join(os.path.dirname(__file__), 'conveyor_models.pkl')
print(f'3. Exporting Models to {output_path}...')
joblib.dump({'classifier': classifier, 'regressor': regressor, 'version': 'rf-trajectory-v1'}, output_path)
print('Pipeline Complete.')
