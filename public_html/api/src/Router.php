<?php
declare(strict_types=1);

final class Router
{
    /** @var array<string, array<string, array{0:class-string,1:string}>> */
    private array $routes = [];

    public function get(string $p, array $h): void   { $this->routes['GET'][$p] = $h; }
    public function post(string $p, array $h): void  { $this->routes['POST'][$p] = $h; }
    public function patch(string $p, array $h): void { $this->routes['PATCH'][$p] = $h; }
    public function delete(string $p, array $h): void{ $this->routes['DELETE'][$p] = $h; }

    public function dispatch(string $method, string $path): void
    {
        $handler = $this->routes[$method][$path] ?? null;
        if ($handler === null) {
            Http::json(['error' => 'not_found', 'message' => 'No such endpoint.'], 404);
        }
        if ($method !== 'GET') Http::requireClientHeader();
        [$class, $action] = $handler;
        (new $class())->$action();
    }
}
