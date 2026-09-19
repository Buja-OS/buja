<?php
declare(strict_types=1);

final class MeController
{
    public function show(): void
    {
        $u = Auth::user();
        if ($u === null) Http::json(['user' => null]);
        Http::json(['user' => Auth::publicUser($u)]);
    }

    /** Onboarding and profile basics: kind (resident|company|landlord), district, phone, name. */
    public function update(): void
    {
        $u = Auth::require();
        $b = Http::body();
        $sets = []; $params = []; $errors = [];

        if (array_key_exists('kind', $b)) {
            $k = Validator::kind((string) $b['kind']);
            if ($k === null) $errors['kind'] = 'Choose resident, company or landlord.';
            else { $sets[] = 'kind = ?'; $params[] = $k; }
        }
        if (array_key_exists('district', $b)) {
            $d = trim((string) $b['district']);
            if ($d === '' || mb_strlen($d) > 60) $errors['district'] = 'Choose your district.';
            else { $sets[] = 'district = ?'; $params[] = $d; }
        }
        if (array_key_exists('phone', $b)) {
            $p = Validator::ngPhone((string) $b['phone']);
            if ($p === null) $errors['phone'] = 'Enter a valid Nigerian phone number.';
            elseif (Db::one('SELECT id FROM users WHERE phone = ? AND id <> ?', [$p, $u['id']])) $errors['phone'] = 'This phone number is already in use.';
            else { $sets[] = 'phone = ?'; $params[] = $p; }
        }
        if (array_key_exists('name', $b)) {
            $n = Validator::name((string) $b['name']);
            if ($n === null) $errors['name'] = 'Enter your full name.';
            else { $sets[] = 'name = ?'; $params[] = $n; }
        }
        if ($errors) Http::json(['error' => 'validation', 'fields' => $errors], 422);
        if (!$sets)  Http::json(['error' => 'validation', 'message' => 'Nothing to update.'], 422);

        $sets[] = 'updated_at = ?'; $params[] = Db::now(); $params[] = $u['id'];
        Db::run('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
        $fresh = Db::one('SELECT * FROM users WHERE id = ?', [$u['id']]);
        Http::json(['user' => Auth::publicUser($fresh)]);
    }
}
