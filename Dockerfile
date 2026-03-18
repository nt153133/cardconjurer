# syntax = docker/dockerfile:1.2
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY CardConjurer.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS prod
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
# Create empty stub directories for the three bind mounts.
# wwwroot/img and wwwroot/local_art are excluded from the image (see .dockerignore).
# data/ holds server-side cards and user uploads and must always be mounted.
RUN mkdir -p wwwroot/img wwwroot/local_art data
ENTRYPOINT ["dotnet", "CardConjurer.dll"]

