package applewallet

import (
	"archive/zip"
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"image"
	"image/color"
	"image/png"
	"io"
	"math/big"
	"testing"
	"time"

	"go.mozilla.org/pkcs7"
)

func TestGenerateCreatesSignedPassWithUserQRCode(t *testing.T) {
	generator := newTestGenerator(t)

	pass, err := generator.Generate("user-123", "hacker@example.com")
	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}

	reader, err := zip.NewReader(bytes.NewReader(pass), int64(len(pass)))
	if err != nil {
		t.Fatalf("open generated pass: %v", err)
	}

	files := make(map[string][]byte, len(reader.File))
	for _, file := range reader.File {
		stream, err := file.Open()
		if err != nil {
			t.Fatalf("open %s: %v", file.Name, err)
		}
		contents, err := io.ReadAll(stream)
		stream.Close()
		if err != nil {
			t.Fatalf("read %s: %v", file.Name, err)
		}
		files[file.Name] = contents
	}

	for _, required := range []string{
		"pass.json",
		"icon.png",
		"icon@2x.png",
		"icon@3x.png",
		"manifest.json",
		"signature",
	} {
		if _, ok := files[required]; !ok {
			t.Errorf("generated pass is missing %s", required)
		}
	}

	var definition passDefinition
	if err := json.Unmarshal(files["pass.json"], &definition); err != nil {
		t.Fatalf("decode pass.json: %v", err)
	}
	if definition.SerialNumber != "user-123" {
		t.Errorf("serialNumber = %q, want user-123", definition.SerialNumber)
	}
	if len(definition.Barcodes) != 1 || definition.Barcodes[0].Message != "user-123" {
		t.Errorf("QR barcode does not contain the user ID: %#v", definition.Barcodes)
	}
	if len(definition.Generic.SecondaryFields) != 1 || definition.Generic.SecondaryFields[0].Value != "hacker@example.com" {
		t.Errorf("attendee field does not contain the email: %#v", definition.Generic.SecondaryFields)
	}

	var manifest map[string]string
	if err := json.Unmarshal(files["manifest.json"], &manifest); err != nil {
		t.Fatalf("decode manifest.json: %v", err)
	}
	for name, expectedHash := range manifest {
		hash := sha1.Sum(files[name])
		if actual := hex.EncodeToString(hash[:]); actual != expectedHash {
			t.Errorf("manifest hash for %s = %s, want %s", name, actual, expectedHash)
		}
	}

	signature, err := pkcs7.Parse(files["signature"])
	if err != nil {
		t.Fatalf("parse signature: %v", err)
	}
	signature.Content = files["manifest.json"]
	if err := signature.Verify(); err != nil {
		t.Fatalf("verify signature: %v", err)
	}
}

func TestGenerateRequiresUserID(t *testing.T) {
	generator := newTestGenerator(t)

	if _, err := generator.Generate("", "hacker@example.com"); err == nil {
		t.Fatal("Generate() error = nil, want an error")
	}
}

func newTestGenerator(t *testing.T) *Generator {
	t.Helper()

	wwdrKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate WWDR key: %v", err)
	}
	now := time.Now()
	wwdrTemplate := &x509.Certificate{
		SerialNumber:          big.NewInt(1),
		Subject:               pkix.Name{CommonName: "Test WWDR"},
		NotBefore:             now.Add(-time.Hour),
		NotAfter:              now.Add(time.Hour),
		IsCA:                  true,
		BasicConstraintsValid: true,
		KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
	}
	wwdrDER, err := x509.CreateCertificate(rand.Reader, wwdrTemplate, wwdrTemplate, &wwdrKey.PublicKey, wwdrKey)
	if err != nil {
		t.Fatalf("create WWDR certificate: %v", err)
	}
	wwdrCertificate, err := x509.ParseCertificate(wwdrDER)
	if err != nil {
		t.Fatalf("parse WWDR certificate: %v", err)
	}

	passKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate pass key: %v", err)
	}
	passTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2),
		Subject:      pkix.Name{CommonName: "pass.com.example.test"},
		NotBefore:    now.Add(-time.Hour),
		NotAfter:     now.Add(time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}
	passDER, err := x509.CreateCertificate(rand.Reader, passTemplate, wwdrCertificate, &passKey.PublicKey, wwdrKey)
	if err != nil {
		t.Fatalf("create pass certificate: %v", err)
	}

	privateKey := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: mustMarshalPKCS8PrivateKey(t, passKey),
	})

	generator, err := New(Config{
		PassTypeIdentifier: "pass.com.example.test",
		TeamIdentifier:     "TEAM123456",
		OrganizationName:   "HackUTD",
		Description:        "HackUTD Hacker Pass",
		Certificate:        passDER,
		PrivateKey:         privateKey,
		WWDRCertificate:    wwdrDER,
		Icon:               testIcon(t),
	})
	if err != nil {
		t.Fatalf("New() error = %v", err)
	}
	return generator
}

func mustMarshalPKCS8PrivateKey(t *testing.T, key *rsa.PrivateKey) []byte {
	t.Helper()
	encoded, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatalf("marshal private key: %v", err)
	}
	return encoded
}

func testIcon(t *testing.T) []byte {
	t.Helper()
	icon := image.NewNRGBA(image.Rect(0, 0, 4, 4))
	for y := range 4 {
		for x := range 4 {
			icon.Set(x, y, color.NRGBA{R: 183, G: 232, B: 112, A: 255})
		}
	}

	var output bytes.Buffer
	if err := png.Encode(&output, icon); err != nil {
		t.Fatalf("encode icon: %v", err)
	}
	return output.Bytes()
}
