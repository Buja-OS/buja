<?php
declare(strict_types=1);

/**
 * Citizen Report: which agency handles what in Abuja, with contacts checked on 21 September 2026 against
 * official sites and reputable Nigerian outlets. Tier 1 numbers are on the agency's own official page.
 * Tier 2 are official but less battle-tested. Nothing unverified is dialled from the app.
 */
final class CitizenController
{
    public const AGENCIES = [
        ['id' => 'emergency', 'name' => 'Emergency (all services)', 'short' => '112', 'cats' => ['emergency'], 'tier' => 1, 'phones' => ['112'], 'emails' => [], 'web' => null, 'note' => 'Free on every network, 24/7. Police, fire, medical, disaster. Use this first for anything life-threatening.'],
        ['id' => 'police', 'name' => 'Nigeria Police, FCT Command', 'short' => 'Police', 'cats' => ['crime', 'security', 'missing'], 'tier' => 1, 'phones' => ['08032003913', '08061581938', '07057337653', '08028940883', '08107314192'], 'emails' => [], 'web' => 'https://x.com/FCT_PoliceNG', 'note' => 'Distress lines and the Complaint Response Unit. Mobile lines change with command; 112 always works.'],
        ['id' => 'fema', 'name' => 'FCT Emergency Management Agency (FEMA)', 'short' => 'FEMA', 'cats' => ['flood', 'collapse', 'disaster', 'fire'], 'tier' => 1, 'phones' => ['08057224574', '08188888766', '112'], 'emails' => ['info@fema.abj.gov.ng'], 'web' => 'https://fema.abj.gov.ng', 'note' => 'Floods, building collapse, mass incidents. Plot 14 Yakubu Gowon Crescent, Asokoro.'],
        ['id' => 'fire', 'name' => 'Federal Fire Service', 'short' => 'Fire', 'cats' => ['fire'], 'tier' => 1, 'phones' => ['08032003557', '112'], 'emails' => ['info@fedfire.gov.ng'], 'web' => 'https://fedfire.gov.ng', 'note' => 'Fire and rescue. HQ Area 10, Garki.'],
        ['id' => 'frsc', 'name' => 'Federal Road Safety Corps', 'short' => 'FRSC', 'cats' => ['accident', 'road'], 'tier' => 1, 'phones' => ['122', '07002255-3772'], 'emails' => ['info@frsc.gov.ng'], 'web' => 'https://frsc.gov.ng', 'note' => 'Crashes, road hazards, reckless driving. 122 is toll-free.'],
        ['id' => 'aedc', 'name' => 'Abuja Electricity (AEDC)', 'short' => 'AEDC', 'cats' => ['power'], 'tier' => 1, 'phones' => ['08039070070', '08150181818', '08150191919'], 'emails' => ['customercare@abujaelectricity.com'], 'whatsapp' => ['08152141414', '08152151515'], 'web' => 'https://abujaelectricity.com', 'note' => 'Outages, faults, billing, meters, fallen cables.'],
        ['id' => 'water', 'name' => 'FCT Water Board', 'short' => 'Water', 'cats' => ['water'], 'tier' => 1, 'phones' => ['08059710600', '08154020688'], 'emails' => ['info@fctwb.gov.ng'], 'web' => 'https://fctwb.gov.ng', 'note' => 'No water, low pressure, burst pipes, new connections.'],
        ['id' => 'fcta', 'name' => 'FCT Administration (general complaints)', 'short' => 'FCTA', 'cats' => ['waste', 'noise', 'sanitation', 'building', 'land', 'general', 'council'], 'tier' => 1, 'phones' => ['08099936312', '07080631500'], 'emails' => ['contactfcta@fcta.gov.ng'], 'web' => 'https://myfctagov.ng', 'note' => 'The central desk. Use this for refuse, noise, illegal structures and anything the area council should handle, because those bodies publish no working line.'],
        ['id' => 'nscdc', 'name' => 'Civil Defence (NSCDC)', 'short' => 'NSCDC', 'cats' => ['vandalism', 'security'], 'tier' => 1, 'phones' => ['199', '092914164'], 'emails' => [], 'web' => 'https://nscdc.gov.ng', 'note' => 'Vandalism of pipelines, cables and public property; illegal mining; private guard complaints.'],
        ['id' => 'nema', 'name' => 'National Emergency Management (NEMA)', 'short' => 'NEMA', 'cats' => ['disaster', 'flood'], 'tier' => 2, 'phones' => ['080022556362'], 'emails' => ['info@nema.gov.ng'], 'web' => 'https://nema.gov.ng', 'note' => 'National disasters and humanitarian emergencies. Toll-free.'],
        ['id' => 'fccpc', 'name' => 'Consumer Protection (FCCPC)', 'short' => 'FCCPC', 'cats' => ['consumer'], 'tier' => 1, 'phones' => ['08056002020', '08056003030'], 'emails' => ['contact@fccpc.gov.ng'], 'web' => 'https://fccpc.gov.ng', 'note' => 'Faulty goods, bad service, unfair pricing, refunds refused.'],
        ['id' => 'ncc', 'name' => 'Telecoms Commission (NCC)', 'short' => 'NCC', 'cats' => ['telecom'], 'tier' => 1, 'phones' => ['622'], 'emails' => [], 'web' => 'https://consumer.ncc.gov.ng', 'note' => 'Network billing, poor signal, spam messages. Complain to your network first, then 622. Text STOP to 2442 to block promo messages.'],
        ['id' => 'nafdac', 'name' => 'NAFDAC', 'short' => 'NAFDAC', 'cats' => ['fake', 'food'], 'tier' => 1, 'phones' => ['08001623322', '09097630506', '09097630507'], 'emails' => ['reform@nafdac.gov.ng'], 'web' => 'https://nafdac.gov.ng', 'note' => 'Fake drugs, unsafe food or drink, counterfeit products. Text a drug batch to 20543 to check it.'],
        ['id' => 'efcc', 'name' => 'EFCC', 'short' => 'EFCC', 'cats' => ['fraud', 'corruption'], 'tier' => 1, 'phones' => ['08093322644', '099044751'], 'emails' => ['info@efcc.gov.ng'], 'web' => 'https://efcc.gov.ng', 'note' => 'Fraud, scams, money laundering, bribery involving money.'],
        ['id' => 'icpc', 'name' => 'ICPC', 'short' => 'ICPC', 'cats' => ['corruption'], 'tier' => 1, 'phones' => ['08031230280', '08031230281', '07056990190', '080022554272'], 'emails' => ['info@icpc.gov.ng'], 'web' => 'https://icpc.gov.ng/petition', 'note' => 'A public official asking for a bribe, abuse of office. Toll-free lines.'],
        ['id' => 'naptip', 'name' => 'NAPTIP', 'short' => 'NAPTIP', 'cats' => ['trafficking', 'gbv'], 'tier' => 1, 'phones' => ['07030000203', '08002255627874', '627'], 'emails' => ['info@naptip.gov.ng'], 'web' => 'https://naptip.gov.ng', 'note' => 'Human trafficking, and sexual or gender-based violence. 627 is a short code on MTN and Airtel.'],
        ['id' => 'sgbv', 'name' => 'FCT Gender-Based Violence Response Team', 'short' => 'GBV team', 'cats' => ['gbv'], 'tier' => 2, 'phones' => ['08078111126', '07051445091', '07041149456', '09029576000'], 'emails' => ['abujasgbvrt@gmail.com'], 'web' => 'https://x.com/fctsgbvrt', 'note' => 'Rape, domestic violence, abuse. Confidential. Numbers confirmed through partner organisations rather than a government page.'],
        ['id' => 'ncdc', 'name' => 'Disease Control (NCDC)', 'short' => 'NCDC', 'cats' => ['health'], 'tier' => 1, 'phones' => ['6232', '08009700000-10'], 'emails' => ['info@ncdc.gov.ng'], 'whatsapp' => ['07087110839'], 'web' => 'https://ncdc.gov.ng', 'note' => 'Suspected outbreaks: cholera, Lassa, meningitis. 6232 is toll-free.'],
        ['id' => 'medical', 'name' => 'Medical emergency (NEMSAS, FCT)', 'short' => 'Ambulance', 'cats' => ['emergency', 'health'], 'tier' => 2, 'phones' => ['112', '09157892931', '09157892932'], 'emails' => [], 'web' => null, 'note' => 'Ambulance and emergency medical response for the FCT.'],
        ['id' => 'vio', 'name' => 'Road Traffic Services (VIO)', 'short' => 'VIO', 'cats' => ['road'], 'tier' => 2, 'phones' => ['08010101010'], 'emails' => [], 'web' => 'https://drts.gov.ng', 'note' => 'Vehicle papers, roadworthiness, VIO conduct. An office line, not an emergency one.'],
        ['id' => 'aumtco', 'name' => 'Abuja buses (AUMTCO)', 'short' => 'AUMTCO', 'cats' => ['transport'], 'tier' => 2, 'phones' => ['092914742', '08060546472', '08078335369'], 'emails' => [], 'web' => 'https://aumtco.abujainvestments.com', 'note' => 'The green government buses: conduct, routes, lost property.'],
        ['id' => 'transport', 'name' => 'FCT Transportation Secretariat', 'short' => 'Transport', 'cats' => ['transport'], 'tier' => 2, 'phones' => ['08107060663'], 'emails' => ['stransport@fct.gov.ng'], 'web' => null, 'note' => 'Taxi and keke regulation, parks, fares policy.'],
        ['id' => 'social', 'name' => 'FCT Social Development Secretariat', 'short' => 'Social', 'cats' => ['child', 'welfare'], 'tier' => 2, 'phones' => ['08036003744'], 'emails' => [], 'web' => null, 'note' => 'Child welfare, street children, destitute persons, orphanages.'],
        ['id' => 'immigration', 'name' => 'Nigeria Immigration Service', 'short' => 'NIS', 'cats' => ['immigration'], 'tier' => 2, 'phones' => ['09121900655', '09121556359', '09121477092'], 'emails' => ['nis.servicom@nigeriaimmigration.gov.ng'], 'web' => 'https://immigration.gov.ng', 'note' => 'Passports, permits, immigration matters. National lines; there is no FCT-specific number.'],
        ['id' => 'pcc', 'name' => 'Public Complaints Commission', 'short' => 'Ombudsman', 'cats' => ['general'], 'tier' => 3, 'phones' => [], 'emails' => [], 'web' => 'https://pcc.gov.ng', 'note' => 'Unfair treatment by a government office or company. No reliable phone published; use the website.'],
    ];
    public const CATS = ['emergency' => 'Emergency', 'crime' => 'Crime or theft', 'security' => 'Security threat', 'missing' => 'Missing person', 'accident' => 'Road accident', 'road' => 'Bad road or traffic', 'fire' => 'Fire', 'flood' => 'Flooding', 'collapse' => 'Building collapse', 'power' => 'Electricity', 'water' => 'Water supply', 'waste' => 'Refuse or dumping', 'noise' => 'Noise', 'sanitation' => 'Sanitation or drains', 'building' => 'Illegal structure', 'land' => 'Land or demolition', 'vandalism' => 'Vandalism', 'consumer' => 'Consumer complaint', 'telecom' => 'Network or telecom', 'fake' => 'Fake drugs or products', 'food' => 'Unsafe food', 'fraud' => 'Fraud or scam', 'corruption' => 'Bribery or corruption', 'gbv' => 'Sexual or gender violence', 'trafficking' => 'Human trafficking', 'child' => 'Child welfare', 'health' => 'Disease outbreak', 'transport' => 'Bus, taxi or keke', 'immigration' => 'Immigration', 'general' => 'Something else'];

    /** GET /citizen/agencies?category= */
    public function agencies(): void
    {
        Auth::require();
        $cat = (string) ($_GET['category'] ?? '');
        $list = array_values(array_filter(self::AGENCIES, fn($a) => $cat === '' || in_array($cat, $a['cats'], true)));
        Http::json(['agencies' => $list, 'categories' => self::CATS, 'checked' => '21 September 2026']);
    }

    /** POST /citizen/reports : keeps a copy of what you sent, so you have a record and a reference number */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('citizen', 20, 86400);
        $b = Http::body();
        $agency = (string) ($b['agency'] ?? ''); if (!in_array($agency, array_column(self::AGENCIES, 'id'), true)) Http::json(['error' => 'validation', 'message' => 'Pick an agency.'], 422);
        $cat = (string) ($b['category'] ?? 'general'); if (!isset(self::CATS[$cat])) $cat = 'general';
        $body = mb_substr(trim((string) ($b['body'] ?? '')), 0, 2000); if (mb_strlen($body) < 10) Http::json(['error' => 'validation', 'fields' => ['body' => 'Describe what happened, at least a line.']], 422);
        $channel = in_array($b['channel'] ?? '', ['call', 'email', 'whatsapp', 'web'], true) ? $b['channel'] : 'call';
        $upload = !empty($b['uploadId']) ? UploadsController::claim((int) $b['uploadId'], $u) : null;
        Db::run('INSERT INTO citizen_reports (user_id, agency, category, body, district, lat, lng, upload_id, channel, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$u['id'], $agency, $cat, $body, mb_substr((string) ($b['district'] ?? ($u['district'] ?? '')), 0, 60) ?: null, !empty($b['lat']) ? (float) $b['lat'] : null, !empty($b['lng']) ? (float) $b['lng'] : null, $upload, $channel, Db::now()]);
        $id = (int) Db::lastId();
        Track::hit($u, 'citizen', 'report:' . $cat);
        Http::json(['report' => ['id' => $id, 'ref' => 'BJ-' . strtoupper(base_convert((string) ($id * 7919), 10, 36)), 'at' => Db::now()]], 201);
    }

    /** GET /citizen/reports : my reports */
    public function mine(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT * FROM citizen_reports WHERE user_id = ? ORDER BY id DESC LIMIT 50'); $st->execute([$u['id']]);
        $names = array_column(self::AGENCIES, 'name', 'id');
        Http::json(['reports' => array_map(fn($r) => ['id' => (int) $r['id'], 'ref' => 'BJ-' . strtoupper(base_convert((string) ((int) $r['id'] * 7919), 10, 36)), 'agency' => $names[$r['agency']] ?? $r['agency'], 'category' => self::CATS[$r['category']] ?? $r['category'], 'body' => $r['body'], 'channel' => $r['channel'], 'at' => $r['created_at'], 'attachment' => UploadsController::shape($r['upload_id'] ? (int) $r['upload_id'] : null)], $st->fetchAll())]);
    }
}
