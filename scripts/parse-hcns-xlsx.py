# Bóc tách file "QUY TRÌNH XỬ LÍ HỒ SƠ HCNS.xlsx" thành JSON để nạp vào hệ thống.
#
#   python scripts/parse-hcns-xlsx.py "<đường dẫn .xlsx>" > snapshots/hcns-templates.json
#
# Tách riêng khỏi bước ghi database để xem trước được kết quả bóc tách. Mỗi DÒNG có số thứ tự là
# một dịch vụ; các dòng không có số thứ tự ngay bên dưới là phần tiếp theo của cùng dịch vụ đó
# (Excel gộp ô). Trong một ô, mỗi dòng bắt đầu bằng "-", "+" hoặc "1." là một bước riêng.
import sys, json, re
import pandas as pd

SHEETS = [('BHXH', 'BHXH'), ('HCNS TRỌN BỘ', 'HCNS')]


def split_steps(text):
    """Một ô có thể chứa nhiều bước, phân cách bằng xuống dòng hoặc dấu đầu dòng."""
    out = []
    for raw in str(text).split('\n'):
        line = raw.strip()
        if not line or line.lower() == 'nan':
            continue
        # Bỏ dấu đầu dòng: "- ", "+ ", "1. ", "1) "
        line = re.sub(r'^[-+•]\s*', '', line)
        line = re.sub(r'^\d+[.)]\s*', '', line)
        line = line.strip()
        if line:
            out.append(line)
    return out


def find_columns(df):
    """Dò vị trí cột theo DÒNG TIÊU ĐỀ, không đoán cứng — file thật có một cột trống ở đầu nên
    đánh số cứng sẽ lệch hết."""
    for i in range(min(10, len(df))):
        vals = ['' if pd.isna(v) else str(v).strip() for v in df.iloc[i].tolist()]
        if any(v.upper() == 'STT' for v in vals):
            col = {'header_row': i}
            for j, v in enumerate(vals):
                u = v.upper()
                if u == 'STT': col['stt'] = j
                elif 'TÊN' in u: col['name'] = j
                elif 'QUY TRÌNH' in u: col['steps'] = j
            col['rest_from'] = max(col.get('steps', 1) + 1, 0)
            return col
    return None


def parse(path):
    items = []
    order = 0
    for sheet, group in SHEETS:
        df = pd.read_excel(path, sheet_name=sheet, header=None)
        col = find_columns(df)
        if not col or 'stt' not in col or 'name' not in col or 'steps' not in col:
            print('Không tìm được dòng tiêu đề ở sheet ' + sheet, file=sys.stderr)
            continue

        cur = None
        for idx in range(col['header_row'] + 1, len(df)):
            vals = ['' if pd.isna(v) else str(v).strip() for v in df.iloc[idx].tolist()]
            get = lambda k: vals[col[k]] if col.get(k) is not None and col[k] < len(vals) else ''
            stt, name, steps_cell = get('stt'), get('name'), get('steps')
            rest = [v for v in vals[col['rest_from']:] if v]

            # Dòng mở đầu một dịch vụ mới: có số thứ tự VÀ có tên
            if re.fullmatch(r'\d+(\.0)?', stt) and name:
                order += 1
                cur = {'group': group, 'name': name, 'order': order, 'tasks': [], 'note_parts': []}
                items.append(cur)
            if cur is None:
                continue
            if steps_cell:
                cur['tasks'].extend(split_steps(steps_cell))
            for r in rest:
                for part in split_steps(r):
                    if part not in cur['note_parts']:
                        cur['note_parts'].append(part)

    for it in items:
        it['note'] = ' · '.join(it.pop('note_parts'))
        seen, uniq = set(), []
        for t in it['tasks']:
            k = t.lower()
            if k not in seen:
                seen.add(k)
                uniq.append(t)
        it['tasks'] = uniq
    # GIỮ cả dịch vụ chưa có bước nào — trong file thật có mục 'Bảng lương, Bảng chấm công'
    # bỏ trống phần quy trình. Lọc bỏ sẽ khiến dịch vụ đó biến mất mà không ai biết.
    return items


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Thiếu đường dẫn file .xlsx', file=sys.stderr)
        sys.exit(1)
    data = parse(sys.argv[1])
    print(json.dumps(data, ensure_ascii=False, indent=1))
