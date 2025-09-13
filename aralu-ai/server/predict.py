import sys
import json
import pandas as pd
import numpy as np

def predict_cycle_length_simple(events):
    """
    Simple statistical approach - often more reliable than ML for menstrual cycles
    """
    try:
        if not events or len(events) == 0:
            return None
            
        df = pd.DataFrame(events)
        df['event_date'] = pd.to_datetime(df['event_date'], errors='coerce')
        df = df.dropna(subset=['event_date']).sort_values('event_date')

        start_dates = df[df['event_type'] == 'start']['event_date']
        
        if len(start_dates) < 2:
            return None

        # Calculate all cycle lengths
        cycle_lengths = (start_dates.iloc[1:].reset_index(drop=True) - 
                        start_dates.iloc[:-1].reset_index(drop=True)).dt.days
        
        # Filter realistic cycles
        realistic_cycles = cycle_lengths[(cycle_lengths >= 15) & (cycle_lengths <= 50)]
        
        if len(realistic_cycles) == 0:
            return None
            
        # Weight recent cycles more heavily (last 3 cycles get 60% weight)
        if len(realistic_cycles) >= 3:
            recent_cycles = realistic_cycles.iloc[-3:]
            older_cycles = realistic_cycles.iloc[:-3] if len(realistic_cycles) > 3 else pd.Series([], dtype='int64')
            
            # Weighted average: recent cycles * 0.6 + older cycles * 0.4
            if len(older_cycles) > 0:
                prediction = (recent_cycles.mean() * 0.6 + older_cycles.mean() * 0.4)
            else:
                prediction = recent_cycles.mean()
        else:
            # Simple average for few data points
            prediction = realistic_cycles.mean()
            
        return int(round(prediction))
        
    except Exception:
        return None

def main():
    try:
        input_data = sys.stdin.read().strip()
        if not input_data:
            print(json.dumps({'predicted_cycle_length': None}))
            return
            
        data = json.loads(input_data)
        events = data.get('events', [])
        
        prediction = predict_cycle_length_simple(events)
        print(json.dumps({'predicted_cycle_length': prediction}))
        
    except Exception as e:
        print(json.dumps({'error': str(e), 'predicted_cycle_length': None}), file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()