import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 }, // ramp-up to 100 users
    { duration: '5m', target: 100 },
    { duration: '1m', target: 0 },   // ramp-down
  ],
};

export default function () {
  let res = http.get('http://example.com/');
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(1);
}
