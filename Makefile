start:
	docker compose up -d

run:
	dotnet run --project CardConjurer/CardConjurer.csproj

build:
	dotnet build CardConjurer/CardConjurer.csproj
