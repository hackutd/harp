package applewallet

import (
	"archive/zip"
	"bytes"
	"crypto"
	"crypto/ecdsa"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"image"
	"image/png"
	"strings"
	"time"

	"go.mozilla.org/pkcs7"
)

const (
	defaultBackgroundColor = "rgb(19, 24, 21)"
	defaultForegroundColor = "rgb(255, 255, 255)"
	defaultLabelColor      = "rgb(183, 232, 112)"
)

type Config struct {
	PassTypeIdentifier string
	TeamIdentifier     string
	OrganizationName   string
	Description        string
	Certificate        []byte
	PrivateKey         []byte
	WWDRCertificate    []byte
	Icon               []byte
}

type Generator struct {
	config          Config
	certificate     *x509.Certificate
	privateKey      crypto.PrivateKey
	wwdrCertificate *x509.Certificate
	icons           map[string][]byte
}

type passField struct {
	Key   string `json:"key"`
	Label string `json:"label"`
	Value string `json:"value"`
}

type barcode struct {
	Format          string `json:"format"`
	Message         string `json:"message"`
	MessageEncoding string `json:"messageEncoding"`
}

type passDefinition struct {
	FormatVersion      int    `json:"formatVersion"`
	PassTypeIdentifier string `json:"passTypeIdentifier"`
	SerialNumber       string `json:"serialNumber"`
	TeamIdentifier     string `json:"teamIdentifier"`
	OrganizationName   string `json:"organizationName"`
	Description        string `json:"description"`
	LogoText           string `json:"logoText"`
	BackgroundColor    string `json:"backgroundColor"`
	ForegroundColor    string `json:"foregroundColor"`
	LabelColor         string `json:"labelColor"`
	SharingProhibited  bool   `json:"sharingProhibited"`
	Generic            struct {
		PrimaryFields   []passField `json:"primaryFields"`
		SecondaryFields []passField `json:"secondaryFields"`
		BackFields      []passField `json:"backFields"`
	} `json:"generic"`
	Barcode  barcode   `json:"barcode"`
	Barcodes []barcode `json:"barcodes"`
}

func New(config Config) (*Generator, error) {
	if strings.TrimSpace(config.PassTypeIdentifier) == "" {
		return nil, errors.New("pass type identifier is required")
	}
	if strings.TrimSpace(config.TeamIdentifier) == "" {
		return nil, errors.New("team identifier is required")
	}
	if strings.TrimSpace(config.OrganizationName) == "" {
		return nil, errors.New("organization name is required")
	}
	if strings.TrimSpace(config.Description) == "" {
		return nil, errors.New("description is required")
	}

	certificate, err := parseCertificate(config.Certificate)
	if err != nil {
		return nil, fmt.Errorf("parse pass certificate: %w", err)
	}

	privateKey, err := parsePrivateKey(config.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("parse pass private key: %w", err)
	}

	wwdrCertificate, err := parseCertificate(config.WWDRCertificate)
	if err != nil {
		return nil, fmt.Errorf("parse WWDR certificate: %w", err)
	}

	if err := validateKeyPair(certificate, privateKey); err != nil {
		return nil, err
	}

	if now := time.Now(); now.Before(certificate.NotBefore) || now.After(certificate.NotAfter) {
		return nil, fmt.Errorf("pass certificate is not valid at the current time")
	}

	icons, err := makeIcons(config.Icon)
	if err != nil {
		return nil, fmt.Errorf("prepare pass icon: %w", err)
	}

	return &Generator{
		config:          config,
		certificate:     certificate,
		privateKey:      privateKey,
		wwdrCertificate: wwdrCertificate,
		icons:           icons,
	}, nil
}

func (g *Generator) Generate(userID, email string) ([]byte, error) {
	if strings.TrimSpace(userID) == "" {
		return nil, errors.New("user ID is required")
	}

	passJSON, err := json.Marshal(g.passDefinition(userID, email))
	if err != nil {
		return nil, fmt.Errorf("marshal pass definition: %w", err)
	}

	files := map[string][]byte{
		"pass.json": passJSON,
	}
	for name, icon := range g.icons {
		files[name] = icon
	}

	manifest := make(map[string]string, len(files))
	for name, contents := range files {
		hash := sha1.Sum(contents) // Apple Wallet's manifest format requires SHA-1.
		manifest[name] = hex.EncodeToString(hash[:])
	}

	manifestJSON, err := json.Marshal(manifest)
	if err != nil {
		return nil, fmt.Errorf("marshal pass manifest: %w", err)
	}

	signature, err := g.sign(manifestJSON)
	if err != nil {
		return nil, err
	}

	files["manifest.json"] = manifestJSON
	files["signature"] = signature

	var output bytes.Buffer
	archive := zip.NewWriter(&output)
	for _, name := range []string{
		"pass.json",
		"icon.png",
		"icon@2x.png",
		"icon@3x.png",
		"manifest.json",
		"signature",
	} {
		entry, err := archive.Create(name)
		if err != nil {
			return nil, fmt.Errorf("create pass archive entry %q: %w", name, err)
		}
		if _, err := entry.Write(files[name]); err != nil {
			return nil, fmt.Errorf("write pass archive entry %q: %w", name, err)
		}
	}
	if err := archive.Close(); err != nil {
		return nil, fmt.Errorf("finish pass archive: %w", err)
	}

	return output.Bytes(), nil
}

func (g *Generator) passDefinition(userID, email string) passDefinition {
	code := barcode{
		Format:          "PKBarcodeFormatQR",
		Message:         userID,
		MessageEncoding: "iso-8859-1",
	}

	pass := passDefinition{
		FormatVersion:      1,
		PassTypeIdentifier: g.config.PassTypeIdentifier,
		SerialNumber:       userID,
		TeamIdentifier:     g.config.TeamIdentifier,
		OrganizationName:   g.config.OrganizationName,
		Description:        g.config.Description,
		LogoText:           g.config.OrganizationName,
		BackgroundColor:    defaultBackgroundColor,
		ForegroundColor:    defaultForegroundColor,
		LabelColor:         defaultLabelColor,
		SharingProhibited:  true,
		Barcode:            code,
		Barcodes:           []barcode{code},
	}

	pass.Generic.PrimaryFields = []passField{{
		Key:   "pass",
		Label: "HACKER",
		Value: "Event Pass",
	}}
	if email != "" {
		pass.Generic.SecondaryFields = []passField{{
			Key:   "email",
			Label: "ATTENDEE",
			Value: email,
		}}
	}
	pass.Generic.BackFields = []passField{{
		Key:   "instructions",
		Label: "HOW TO USE",
		Value: "Show this pass at check-in, meals, and events.",
	}}

	return pass
}

func (g *Generator) sign(manifest []byte) ([]byte, error) {
	signedData, err := pkcs7.NewSignedData(manifest)
	if err != nil {
		return nil, fmt.Errorf("initialize pass signature: %w", err)
	}
	if err := signedData.AddSignerChain(
		g.certificate,
		g.privateKey,
		[]*x509.Certificate{g.wwdrCertificate},
		pkcs7.SignerInfoConfig{},
	); err != nil {
		return nil, fmt.Errorf("sign pass manifest: %w", err)
	}
	signedData.Detach()

	signature, err := signedData.Finish()
	if err != nil {
		return nil, fmt.Errorf("finish pass signature: %w", err)
	}
	return signature, nil
}

func parseCertificate(value []byte) (*x509.Certificate, error) {
	if len(value) == 0 {
		return nil, errors.New("certificate is empty")
	}

	if block, _ := pem.Decode(value); block != nil {
		value = block.Bytes
	}
	return x509.ParseCertificate(value)
}

func parsePrivateKey(value []byte) (crypto.PrivateKey, error) {
	if len(value) == 0 {
		return nil, errors.New("private key is empty")
	}

	if block, _ := pem.Decode(value); block != nil {
		if x509.IsEncryptedPEMBlock(block) {
			return nil, errors.New("encrypted PEM private keys are not supported")
		}
		value = block.Bytes
	}

	if key, err := x509.ParsePKCS8PrivateKey(value); err == nil {
		return key, nil
	}
	if key, err := x509.ParsePKCS1PrivateKey(value); err == nil {
		return key, nil
	}
	if key, err := x509.ParseECPrivateKey(value); err == nil {
		return key, nil
	}

	return nil, errors.New("private key must be PKCS#8, PKCS#1, or EC")
}

func validateKeyPair(certificate *x509.Certificate, privateKey crypto.PrivateKey) error {
	var publicKey crypto.PublicKey
	switch key := privateKey.(type) {
	case *rsa.PrivateKey:
		publicKey = &key.PublicKey
	case *ecdsa.PrivateKey:
		publicKey = &key.PublicKey
	default:
		return fmt.Errorf("unsupported private key type %T", privateKey)
	}

	certificatePublicKey, err := x509.MarshalPKIXPublicKey(certificate.PublicKey)
	if err != nil {
		return fmt.Errorf("marshal certificate public key: %w", err)
	}
	privatePublicKey, err := x509.MarshalPKIXPublicKey(publicKey)
	if err != nil {
		return fmt.Errorf("marshal private key public key: %w", err)
	}
	if !bytes.Equal(certificatePublicKey, privatePublicKey) {
		return errors.New("pass certificate and private key do not match")
	}

	return nil
}

func makeIcons(source []byte) (map[string][]byte, error) {
	if len(source) == 0 {
		return nil, errors.New("icon is empty")
	}

	decoded, _, err := image.Decode(bytes.NewReader(source))
	if err != nil {
		return nil, err
	}

	icons := make(map[string][]byte, 3)
	for name, size := range map[string]int{
		"icon.png":    29,
		"icon@2x.png": 58,
		"icon@3x.png": 87,
	} {
		resized := image.NewNRGBA(image.Rect(0, 0, size, size))
		bounds := decoded.Bounds()
		for y := 0; y < size; y++ {
			for x := 0; x < size; x++ {
				sourceX := bounds.Min.X + x*bounds.Dx()/size
				sourceY := bounds.Min.Y + y*bounds.Dy()/size
				resized.Set(x, y, decoded.At(sourceX, sourceY))
			}
		}

		var encoded bytes.Buffer
		if err := png.Encode(&encoded, resized); err != nil {
			return nil, err
		}
		icons[name] = encoded.Bytes()
	}

	return icons, nil
}
