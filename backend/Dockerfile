FROM python:3.12-slim

WORKDIR /app

# 보안: 비루트 사용자 생성
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 데이터 디렉토리 권한 설정
RUN mkdir -p /app/data && chown -R appuser:appgroup /app

USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
