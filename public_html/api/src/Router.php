<?php
declare(strict_types=1);

final class Router
{
    /** @var array<string, array<int, array{0:string,1:array,2:string}>> method => [pattern, handler, original] */
    private array $routes = [];

    public function get(string $p, array $h): void    { $this->add('GET', $p, $h); }
    public function post(string $p, array $h): void   { $this->add('POST', $p, $h); }
    public function patch(string $p, array $h): void  { $this->add('PATCH', $p, $h); }
    public function delete(string $p, array $h): void { $this->add('DELETE', $p, $h); }

    private function add(string $m, string $p, array $h): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $p) . '$#';
        $this->routes[$m][] = [$regex, $h, $p];
    }

    public function dispatch(string $method, string $path): void
    {
        foreach ($this->routes[$method] ?? [] as [$regex, $handler]) {
            if (preg_match($regex, $path, $m)) {
                if ($method !== 'GET') Http::requireClientHeader();
                $params = array_filter($m, 'is_string', ARRAY_FILTER_USE_KEY);
                [$class, $action] = $handler;
                (new $class())->$action(...array_values(array_map(fn($v) => ctype_digit($v) ? (int) $v : $v, $params)));
                return;
            }
        }
        Http::json(['error' => 'not_found', 'message' => 'No such endpoint.'], 404);
    }
}
