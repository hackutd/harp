package gcs

import (
	"context"

	"github.com/stretchr/testify/mock"
)

type MockClient struct {
	mock.Mock
}

func (m *MockClient) GenerateUploadURL(ctx context.Context, objectPath string) (string, error) {
	args := m.Called(ctx, objectPath)
	return args.String(0), args.Error(1)
}

func (m *MockClient) GenerateImageUploadURL(ctx context.Context, objectPath string, contentType string) (string, error) {
	args := m.Called(ctx, objectPath, contentType)
	return args.String(0), args.Error(1)
}

func (m *MockClient) GenerateDownloadURL(ctx context.Context, objectPath string) (string, error) {
	args := m.Called(ctx, objectPath)
	return args.String(0), args.Error(1)
}

func (m *MockClient) DeleteObject(ctx context.Context, objectPath string) error {
	args := m.Called(ctx, objectPath)
	return args.Error(0)
}

func (m *MockClient) Close() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockClient) GeneratePublicURL(objectPath string) string {
	args := m.Called(objectPath)
	return args.String(0)
}
