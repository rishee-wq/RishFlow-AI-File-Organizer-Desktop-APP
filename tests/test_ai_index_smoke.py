import time
from app import RishFlowAPI

if __name__ == '__main__':
    api = RishFlowAPI()
    folder = 'sorted'
    print('Starting background index for', folder)
    resp = api.start_index_for_ai(folder)
    print('start response:', resp)
    # poll status
    for i in range(60):
        s = api.get_ai_index_status()
        print(f'[{i}] status: in_progress={s.get("in_progress")}, done={s.get("done")}, total={s.get("total")}, cached={len(getattr(api, "_ai_index", [])) if hasattr(api, "_ai_index") else 0}')
        if not s.get('in_progress'):
            print('Indexing finished')
            break
        time.sleep(1)
    else:
        print('Timed out waiting for index')

    # Quick query
    q = 'RishFlow'
    print('Querying for', q)
    res = api.query_ai(folder, q)
    print('query results:', res.get('results')[:5])
