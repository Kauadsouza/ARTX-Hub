import { test } from 'node:test';
import assert from 'node:assert/strict';
import { certificatePath, certificateReference, parseCertificateReference, validateCertificate, certificateMaxBytes } from '../src/lib/course-certificates.ts';
const origin = 'https://example.supabase.co';
const owner = 'owner-123';
const course = 'cs50x-2026';
test('private certificate references are restricted to owner, course and origin', () => {
  const path = certificatePath(owner, course, 'Meu certificado.pdf', 'version-1');
  const reference = certificateReference(origin, path);
  assert.equal(parseCertificateReference(reference, origin, owner, course).path, path);
  assert.throws(() => parseCertificateReference(reference, origin, 'another-owner', course));
  assert.throws(() => parseCertificateReference(reference, origin, owner, 'cs50-python'));
  assert.throws(() => parseCertificateReference(reference, 'https://attacker.example', owner, course));
  assert.throws(() => parseCertificateReference(reference + '?token=x', origin, owner, course));
  assert.throws(() => certificatePath(owner, '../other', 'test.pdf'));
});
test('file validation rejects empty, oversize, unsupported and disguised files', async () => {
  await validateCertificate(new File(['%PDF-1.4\n'], 'certificate.pdf', {type: 'application/pdf'}));
  await validateCertificate(new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'certificate.png', {type:'image/png'}));
  await validateCertificate(new File([new Uint8Array([255,216,255,224])], 'certificate.jpg', {type:'image/jpeg'}));
  await assert.rejects(validateCertificate(new File([], 'empty.pdf', {type:'application/pdf'})));
  await assert.rejects(validateCertificate(new File(['<html>bad'], 'disguised.pdf', {type:'application/pdf'})));
  await assert.rejects(validateCertificate(new File(['%PDF-1.4'], 'file.svg', {type:'image/svg+xml'})));
  await assert.rejects(validateCertificate(new File([new Uint8Array(certificateMaxBytes+1)], 'large.pdf', {type:'application/pdf'})));
});
