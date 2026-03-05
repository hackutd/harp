package gcs

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/storage"
)

const (
	signedURLExpiry    = 15 * time.Minute
	resumeContentType  = "application/pdf"
	maxResumeSizeBytes = 5 * 1024 * 1024
)

type GCSClient struct {
	client *storage.Client
	bucket *storage.BucketHandle
}

func New(ctx context.Context, bucketName string) (*GCSClient, error) {
	client, err := storage.NewClient(ctx)
	if err != nil {
		return nil, err
	}

	return &GCSClient{
		client: client,
		bucket: client.Bucket(bucketName),
	}, nil
}

func (c *GCSClient) GenerateUploadURL(_ context.Context, objectPath string) (string, error) {
	url, err := c.bucket.SignedURL(objectPath, &storage.SignedURLOptions{
		Method:      "PUT",
		Expires:     time.Now().Add(signedURLExpiry),
		ContentType: resumeContentType,
		Headers: []string{
			fmt.Sprintf("x-goog-content-length-range:0,%d", maxResumeSizeBytes),
		},
		Scheme: storage.SigningSchemeV4,
	})
	if err != nil {
		return "", err
	}

	return url, nil
}

func (c *GCSClient) GenerateDownloadURL(_ context.Context, objectPath string) (string, error) {
	url, err := c.bucket.SignedURL(objectPath, &storage.SignedURLOptions{
		Method:  "GET",
		Expires: time.Now().Add(signedURLExpiry),
		Scheme:  storage.SigningSchemeV4,
	})
	if err != nil {
		return "", err
	}

	return url, nil
}

func (c *GCSClient) DeleteObject(ctx context.Context, objectPath string) error {
	return c.bucket.Object(objectPath).Delete(ctx)
}

func (c *GCSClient) Close() error {
	return c.client.Close()
}
