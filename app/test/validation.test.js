const {test,after}=require('node:test'),assert=require('node:assert/strict'),d=require('../src/domain'),{pool}=require('../src/db');
test('Vietnamese local datetime is converted to the correct UTC instant',()=>assert.equal(d.timestamp('2026-10-24T08:30'),'2026-10-24T01:30:00.000Z'));
test('invalid calendar date, missing time zone shape and reversed interval are rejected',()=>{for(const value of ['2026-02-31T12:00','not-a-date','2026-10-24','2026-13-01T12:00'])assert.throws(()=>d.timestamp(value));assert.throws(()=>d.interval({start_at:'2026-10-24T10:00',end_at:'2026-10-24T09:00'}));});
test('integer validation rejects negative, fractional, infinite and out-of-range values',()=>{for(const value of [-1,'1.5','NaN','Infinity','999999999999999999999'])assert.throws(()=>d.integer(value));assert.equal(d.integer('0'),0);});
test('business codes normalize and reject executable or invalid input',()=>{assert.equal(d.code(' xe-009 '),'XE-009');assert.throws(()=>d.code('<script>'));assert.throws(()=>d.id('0'));});
after(()=>pool.end());
